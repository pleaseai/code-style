import type { PackageJson } from '../src/fs-utils.js'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const CLI = fileURLToPath(new URL('../src/index.ts', import.meta.url))

function run(args: string[], cwd?: string, extraEnv: Record<string, string> = {}) {
  const env = { ...process.env, LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8', LC_MESSAGES: 'en_US.UTF-8', ...extraEnv }
  const res = spawnSync('bun', [CLI, ...args], { encoding: 'utf-8', env, cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  return { status: res.status, stdout: res.stdout, stderr: res.stderr }
}

describe('locale flags', () => {
  test('--locale sets the message language', () => {
    const res = run(['--locale', 'ko', '--help'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('사용법:')
    expect(res.stderr).toBe('')
  })

  test('--lang ko warns that it moved to --locale and still sets the locale', () => {
    const res = run(['--lang', 'ko', '--help'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('사용법:')
    expect(res.stderr).toContain('--locale ko')
  })

  test('--lang overridden by --locale is reported as ignored, not as the migration target', () => {
    const res = run(['--locale', 'en', '--lang', 'ko', '--help'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('Usage:')
    expect(res.stderr).toContain('--lang ko is deprecated and ignored because --locale is set; remove it.')
  })
})

describe('--lang languages', () => {
  test('an unknown value exits non-zero and lists the accepted languages', () => {
    const res = run(['--lang', 'foo', '--help'])
    expect(res.status).toBe(1)
    expect(res.stdout).toBe('')
    expect(res.stderr).toContain('Unknown --lang value: "foo"')
    expect(res.stderr).toContain('typescript')
    expect(res.stderr).toContain('html-css')
    expect(res.stderr).toContain('--locale <ko|en>')
  })

  test('update --lang dart links the dart guide instead of the TypeScript one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-lang-'))
    try {
      writeFileSync(join(dir, 'package.json'), '{}')
      const res = run(['update', '--lang', 'dart'], dir)
      expect(res.status).toBe(0)
      const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
      expect(body).toContain('.agents/code-style/dart.md')
      expect(body).not.toContain('.agents/code-style/typescript.md')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('doctor --lang reports the given languages instead of the detected ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-lang-'))
    try {
      writeFileSync(join(dir, 'package.json'), '{}')
      const res = run(['doctor', '--lang', 'dart'], dir)
      expect(res.status).toBe(0)
      expect(res.stdout).toContain('Selected languages (--lang): dart')
      expect(res.stdout).not.toContain('typescript')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// The AGENTS.md block exactly as code-style-v0.1.1 wrote it.
const V011_BODY = [
  '# PleaseAI Code Style',
  '',
  'These rules are managed by `@pleaseai/code-style`. Run `pleaseai-code-style update`',
  'to refresh this block. Do not edit between the marker comments \u2014 your changes',
  'will be overwritten.',
  '',
  '- Formatter: `@pleaseai/eslint-config` (wraps `@antfu/eslint-config`)',
  '- No semicolons, single quotes, 2-space indent, trailing commas, LF line endings',
  '- ESM only \u2014 never emit `require`/`module.exports`',
  '- TypeScript: `strict: true`, prefer `type` over `interface`, no implicit `any`',
  '- Prefer named exports, early returns, `async`/`await`, optional chaining',
  '- File size target: ≤ 500 lines',
  '- Tests live under the package\'s `test/` (or `tests/`) root, mirroring the source path',
  '  (`src/foo/bar.ts` → `test/foo/bar.test.ts`); no `import.meta.vitest` in-source tests',
  '- Conventional Commits for all commit messages',
  '',
  'For the full rules (what an AI coding assistant needs to know before writing code),',
  'read `node_modules/@pleaseai/code-style/rules.md`.',
].join('\n')

describe('doctor', () => {
  test('reports @pleaseai/eslint-config as OK without its optional antislop plugins', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-doctor-'))
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { '@pleaseai/eslint-config': '*', 'eslint': '*' } }))
      const res = run(['doctor'], dir)
      expect(res.stdout).toContain('@pleaseai/eslint-config (eslint.config.mjs): OK')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

const ESLINT_CONFIG_DEPS = { '@pleaseai/eslint-config': '*', 'eslint': '*' }

function withProject(pkg: PackageJson | null, files: Record<string, string>, body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-antislop-'))
  try {
    if (pkg !== null) {
      writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
    }
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content)
    }
    body(dir)
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('doctor antislop plugins', () => {
  test('reports missing plugins and the install command for the detected package manager', () => {
    withProject({ devDependencies: ESLINT_CONFIG_DEPS }, { 'pnpm-lock.yaml': '' }, (dir) => {
      const res = run(['doctor'], dir)
      expect(res.status).toBe(0)
      expect(res.stdout).toContain('eslint-plugin-slop (antislop): missing, antislop rules are off')
      expect(res.stdout).toContain('eslint-plugin-sonarjs (antislop): missing, antislop rules are off')
      expect(res.stdout).toContain('pnpm add -D eslint-plugin-slop eslint-plugin-sonarjs')
    })
  })

  test('reports installed plugins as OK without an install command', () => {
    const devDependencies = { ...ESLINT_CONFIG_DEPS, 'eslint-plugin-slop': '*', 'eslint-plugin-sonarjs': '*' }
    withProject({ devDependencies }, {}, (dir) => {
      const res = run(['doctor'], dir)
      expect(res.stdout).toContain('eslint-plugin-slop (antislop): OK')
      expect(res.stdout).toContain('eslint-plugin-sonarjs (antislop): OK')
      expect(res.stdout).not.toContain('Install the missing')
    })
  })

  test('prints nothing about the plugins without @pleaseai/eslint-config', () => {
    withProject({ devDependencies: { eslint: '*' } }, {}, (dir) => {
      expect(run(['doctor'], dir).stdout).not.toContain('antislop')
    })
  })

  test('prints only that antislop is off when the eslint config sets antislop: false', () => {
    withProject({ devDependencies: ESLINT_CONFIG_DEPS }, { 'eslint.config.ts': 'export default pleaseai({ antislop: false })\n' }, (dir) => {
      const res = run(['doctor'], dir)
      expect(res.stdout).toContain('antislop: off')
      expect(res.stdout).not.toContain('missing, antislop rules are off')
      expect(res.stdout).not.toContain('Install the missing')
    })
  })

  test('reports only the plugins the eslint config leaves on', () => {
    withProject({ devDependencies: ESLINT_CONFIG_DEPS }, { 'eslint.config.ts': 'export default pleaseai({ antislop: { sonarjs: false } })\n' }, (dir) => {
      const res = run(['doctor'], dir)
      expect(res.stdout).toContain('eslint-plugin-slop (antislop): missing')
      expect(res.stdout).not.toContain('eslint-plugin-sonarjs')
    })
  })

  test('prints nothing about the plugins without a package.json', () => {
    withProject(null, {}, (dir) => {
      expect(run(['doctor'], dir).stdout).not.toContain('antislop')
    })
  })
})

describe('update antislop plugins', () => {
  function withFakePnpm(body: (dir: string, env: Record<string, string>, argsFile: string) => void, opts: { pkg?: PackageJson | null, files?: Record<string, string> } = {}): void {
    const bin = mkdtempSync(join(tmpdir(), 'pleaseai-cli-bin-'))
    const argsFile = join(bin, 'args.txt')
    writeFileSync(join(bin, 'pnpm'), `#!/bin/sh\necho "$@" > "${argsFile}"\n`, { mode: 0o755 })
    try {
      const pkg = opts.pkg === undefined ? { devDependencies: { ...ESLINT_CONFIG_DEPS, 'eslint-plugin-sonarjs': '*' } } : opts.pkg
      withProject(pkg, { 'pnpm-lock.yaml': '', ...opts.files }, (dir) => {
        body(dir, { PATH: `${bin}:${process.env.PATH}` }, argsFile)
      })
    }
    finally {
      rmSync(bin, { recursive: true, force: true })
    }
  }

  test('--yes installs exactly the missing plugins and prints the suppression next steps', () => {
    withFakePnpm((dir, env, argsFile) => {
      const res = run(['update', '--yes'], dir, env)
      expect(res.status).toBe(0)
      expect(readFileSync(argsFile, 'utf-8').trim()).toBe('add -D eslint-plugin-slop')
      expect(res.stdout).toContain('pnpm exec eslint . --suppress-all')
      expect(res.stdout).toContain('pnpm exec eslint . --prune-suppressions')
    })
  })

  test('--yes at a pnpm workspace root installs with -w', () => {
    withFakePnpm((dir, env, argsFile) => {
      expect(run(['update', '--yes'], dir, env).status).toBe(0)
      expect(readFileSync(argsFile, 'utf-8').trim()).toBe('add -D -w eslint-plugin-slop')
    }, { files: { 'pnpm-workspace.yaml': 'packages: []\n' } })
  })

  for (const content of ['{ not json', 'null']) {
    test(`skips the plugin check when package.json is ${content}`, () => {
      withProject(null, { 'package.json': content }, (dir) => {
        const res = run(['update', '--yes'], dir)
        expect(res.status).toBe(0)
        expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true)
      })
    })
  }

  const NOTHING_TO_INSTALL = [
    { name: 'every plugin is installed', pkg: { devDependencies: { ...ESLINT_CONFIG_DEPS, 'eslint-plugin-slop': '*', 'eslint-plugin-sonarjs': '*' } } },
    { name: '@pleaseai/eslint-config is not installed', pkg: { devDependencies: { eslint: '*' } } },
    { name: 'there is no package.json', pkg: null },
  ]
  for (const { name, pkg } of NOTHING_TO_INSTALL) {
    test(`installs nothing and prints no next steps when ${name}`, () => {
      withFakePnpm((dir, env, argsFile) => {
        const res = run(['update', '--yes'], dir, env)
        expect(res.status).toBe(0)
        expect(existsSync(argsFile)).toBe(false)
        expect(res.stdout).not.toContain('--suppress-all')
      }, { pkg })
    })
  }

  test('does not offer a plugin the eslint config turns off', () => {
    withFakePnpm((dir, env, argsFile) => {
      const res = run(['update', '--yes'], dir, env)
      expect(res.status).toBe(0)
      expect(existsSync(argsFile)).toBe(false)
    }, { files: { 'eslint.config.ts': 'export default pleaseai({ antislop: { slop: false } })\n' } })
  })

  test('without a TTY and without --yes it prints the command and installs nothing', () => {
    withFakePnpm((dir, env, argsFile) => {
      const res = run(['update'], dir, env)
      expect(res.status).toBe(0)
      expect(existsSync(argsFile)).toBe(false)
      expect(res.stdout).toContain('pnpm add -D eslint-plugin-slop')
    })
  })

  test('installs nothing when the eslint config sets antislop: false', () => {
    withFakePnpm((dir, env, argsFile) => {
      expect(run(['update', '--yes'], dir, env).status).toBe(0)
      expect(existsSync(argsFile)).toBe(false)
    }, { files: { 'eslint.config.mjs': 'export default pleaseai({ antislop: false })\n' } })
  })

  test('exits non-zero when the install fails', () => {
    withFakePnpm((dir, env) => {
      writeFileSync(join(env.PATH.split(':')[0]!, 'pnpm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
      expect(run(['update', '--yes'], dir, env).status).toBe(1)
    })
  })
})

describe('projects without a package.json', () => {
  const MARKERS = [
    { marker: 'build.gradle.kts', language: 'java' },
    { marker: 'pubspec.yaml', language: 'dart' },
    { marker: 'Cargo.toml', language: 'rust' },
  ]

  for (const { marker, language } of MARKERS) {
    test(`${marker}: init --yes, update and doctor succeed and link the ${language} guide`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-nopkg-'))
      try {
        writeFileSync(join(dir, marker), '')
        const init = run(['init', '--yes'], dir)
        expect(init.status).toBe(0)
        expect(existsSync(join(dir, 'package.json'))).toBe(false)
        const guide = `.agents/code-style/${language}.md`
        expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain(guide)
        expect(existsSync(join(dir, guide))).toBe(true)
        expect(existsSync(join(dir, 'eslint.config.mjs'))).toBe(false)

        expect(run(['update'], dir).status).toBe(0)
        expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain(guide)

        const doctor = run(['doctor'], dir)
        expect(doctor.status).toBe(0)
        expect(doctor.stdout).toContain(`${guide}: OK`)
        expect(doctor.stdout).not.toContain('package manager')
        expect(doctor.stdout).not.toContain('eslint.config.mjs')
      }
      finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  }

  test('doctor reports a guide the AGENTS.md block links but the project lacks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-nopkg-'))
    try {
      writeFileSync(join(dir, 'pubspec.yaml'), '')
      run(['update'], dir)
      rmSync(join(dir, '.agents/code-style/dart.md'))
      expect(run(['doctor'], dir).stdout).toContain('.agents/code-style/dart.md: missing')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('doctor checks the guide paths a legacy node_modules block links', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-legacy-'))
    try {
      const legacy = 'node_modules/@pleaseai/code-style/rules'
      writeFileSync(join(dir, 'AGENTS.md'), `<!-- pleaseai-code-style:start -->\nread \`${legacy}/general.md\` and \`${legacy}/dart.md\`\n<!-- pleaseai-code-style:end -->\n`)
      mkdirSync(join(dir, legacy), { recursive: true })
      writeFileSync(join(dir, legacy, 'general.md'), '')
      const res = run(['doctor'], dir)
      expect(res.stdout).toContain(`${legacy}/general.md: OK`)
      expect(res.stdout).toContain(`${legacy}/dart.md: missing`)
      expect(res.stdout).not.toContain('.agents/code-style')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('init stops on a symlinked guide directory before writing anything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-nopkg-'))
    const outside = mkdtempSync(join(tmpdir(), 'pleaseai-cli-outside-'))
    try {
      writeFileSync(join(dir, 'pubspec.yaml'), '')
      symlinkSync(outside, join(dir, '.agents'))
      for (const args of [['init', '--yes'], ['init', '--yes', '--lang', 'dart']]) {
        const res = run(args, dir)
        expect(res.status).toBe(1)
        expect(res.stderr).toContain('.agents is a symlink')
        expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false)
      }
      expect(existsSync(join(outside, 'code-style'))).toBe(false)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('update rewrites a legacy node_modules block to the project copies and keeps its languages', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-legacy-'))
    try {
      writeFileSync(join(dir, 'AGENTS.md'), '<!-- pleaseai-code-style:start -->\nread `node_modules/@pleaseai/code-style/rules/general.md` and `node_modules/@pleaseai/code-style/rules/dart.md`\n<!-- pleaseai-code-style:end -->\n')
      expect(run(['update'], dir).status).toBe(0)
      const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
      expect(body).toContain('.agents/code-style/dart.md')
      expect(body).not.toContain('node_modules/@pleaseai/code-style')
      expect(body).not.toContain('typescript.md')
      expect(existsSync(join(dir, '.agents/code-style/dart.md'))).toBe(true)
      expect(existsSync(join(dir, '.agents/code-style/general.md'))).toBe(true)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('pubspec.yaml and Cargo.toml together: init --yes links both guides in guide order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-nopkg-'))
    try {
      writeFileSync(join(dir, 'pubspec.yaml'), '')
      writeFileSync(join(dir, 'Cargo.toml'), '')
      expect(run(['init', '--yes'], dir).status).toBe(0)
      const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
      const linked = [...body.matchAll(/\.agents\/code-style\/([\w./-]+\.md)/g)].map(m => m[1])
      expect(linked).toEqual(['general.md', 'dart.md', 'rust.md'])
      expect(existsSync(join(dir, '.agents/code-style/dart.md'))).toBe(true)
      expect(existsSync(join(dir, '.agents/code-style/rust.md'))).toBe(true)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('existing JS projects', () => {
  test('update on a JS project carrying the v0.1.1 block leaves no broken link', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-v011-'))
    try {
      writeFileSync(join(dir, 'package.json'), '{}')
      writeFileSync(join(dir, 'AGENTS.md'), `<!-- pleaseai-code-style:start -->\n${V011_BODY}\n<!-- pleaseai-code-style:end -->\n`)
      expect(run(['update'], dir).status).toBe(0)
      const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
      expect(body).not.toContain('node_modules/@pleaseai/code-style')
      expect(body).toContain('.agents/code-style/general.md')
      expect(body).toContain('.agents/code-style/typescript.md')
      const linked = [...body.matchAll(/\.agents\/code-style\/[\w./-]+\.md/g)].map(m => m[0])
      expect(linked.length).toBeGreaterThan(0)
      for (const path of linked) {
        expect(existsSync(join(dir, path))).toBe(true)
      }
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
