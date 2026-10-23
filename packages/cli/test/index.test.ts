import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const CLI = fileURLToPath(new URL('../src/index.ts', import.meta.url))

function run(args: string[], cwd?: string): { status: number | null, stdout: string, stderr: string } {
  const env = { ...process.env, LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8', LC_MESSAGES: 'en_US.UTF-8' }
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
        expect(doctor.stdout).toContain(`${guide} — OK`)
        expect(doctor.stdout).not.toContain('package manager')
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
      expect(run(['doctor'], dir).stdout).toContain('.agents/code-style/dart.md — missing')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
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
