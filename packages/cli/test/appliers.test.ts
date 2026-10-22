import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { log } from '@clack/prompts'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { applyAgentsMd, applyAstGrep, applyBunLintConfig, defaultToolIds, findTool, TOOLS } from '../src/appliers.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// ast-grep
// ---------------------------------------------------------------------------

describe('ast-grep tool', () => {
  test('installs the rules package and the ast-grep binary', () => {
    expect(findTool('ast-grep')?.packages).toEqual(['@pleaseai/ast-grep-config', '@ast-grep/cli'])
  })

  test('creates sgconfig.yml pointing at the package rules', async () => {
    const result = await applyAstGrep({ cwd: dir, autoAccept: false })
    expect(result.created).toEqual(['sgconfig.yml'])
    expect(readFileSync(join(dir, 'sgconfig.yml'), 'utf-8'))
      .toContain('ruleDirs:\n  - node_modules/@pleaseai/ast-grep-config/rules\n')
  })

  test('leaves an sgconfig.yml that already lists the rules untouched', async () => {
    const custom = 'ruleDirs:\n  - rules\n  - node_modules/@pleaseai/ast-grep-config/rules\n'
    writeFileSync(join(dir, 'sgconfig.yml'), custom)
    const result = await applyAstGrep({ cwd: dir, autoAccept: false })
    expect(result).toEqual({ created: [], updated: [], skipped: [] })
    expect(readFileSync(join(dir, 'sgconfig.yml'), 'utf-8')).toBe(custom)
  })

  test('accepts the rules listed in a flow-style ruleDirs', async () => {
    const custom = 'ruleDirs: [rules, "node_modules/@pleaseai/ast-grep-config/rules"]\n'
    writeFileSync(join(dir, 'sgconfig.yml'), custom)
    const result = await applyAstGrep({ cwd: dir, autoAccept: false })
    expect(result).toEqual({ created: [], updated: [], skipped: [] })
    expect(readFileSync(join(dir, 'sgconfig.yml'), 'utf-8')).toBe(custom)
  })

  test('accepts the rules listed in a zero-indent block ruleDirs', async () => {
    const custom = 'ruleDirs:\n- rules\n- node_modules/@pleaseai/ast-grep-config/rules\nutilDirs:\n- utils\n'
    writeFileSync(join(dir, 'sgconfig.yml'), custom)
    const result = await applyAstGrep({ cwd: dir, autoAccept: true })
    expect(result).toEqual({ created: [], updated: [], skipped: [] })
    expect(readFileSync(join(dir, 'sgconfig.yml'), 'utf-8')).toBe(custom)
  })

  test('does not treat a commented-out rules path as enabled', async () => {
    writeFileSync(join(dir, 'sgconfig.yml'), 'ruleDirs: []\n# - node_modules/@pleaseai/ast-grep-config/rules\n')
    const result = await applyAstGrep({ cwd: dir, autoAccept: true })
    expect(result.updated).toEqual(['sgconfig.yml'])
    expect(readFileSync(join(dir, 'sgconfig.yml'), 'utf-8')).toContain('ruleDirs:\n  - node_modules/@pleaseai/ast-grep-config/rules\n')
  })

  test('does not write sgconfig.yml under Yarn Plug\'n\'Play, where node_modules does not exist', async () => {
    writeFileSync(join(dir, '.pnp.cjs'), '')
    const result = await applyAstGrep({ cwd: dir, autoAccept: true })
    expect(result).toEqual({ created: [], updated: [], skipped: ['sgconfig.yml'] })
    expect(existsSync(join(dir, 'sgconfig.yml'))).toBe(false)
  })

  test('detects Plug\'n\'Play from a workspace package whose .pnp.cjs is at the workspace root', async () => {
    writeFileSync(join(dir, '.pnp.cjs'), '')
    const pkg = join(dir, 'packages', 'app')
    mkdirSync(pkg, { recursive: true })
    const result = await applyAstGrep({ cwd: pkg, autoAccept: true })
    expect(result.skipped).toEqual(['sgconfig.yml'])
    expect(existsSync(join(pkg, 'sgconfig.yml'))).toBe(false)
  })

  test('writes sgconfig.yml for a node_modules project nested under a Plug\'n\'Play directory', async () => {
    writeFileSync(join(dir, '.pnp.cjs'), '')
    const project = join(dir, 'examples', 'app')
    mkdirSync(join(project, 'node_modules', '@pleaseai', 'ast-grep-config', 'rules'), { recursive: true })
    const result = await applyAstGrep({ cwd: project, autoAccept: true })
    expect(result.created).toEqual(['sgconfig.yml'])
  })

  test('overwrites a different sgconfig.yml when overwrites are accepted', async () => {
    writeFileSync(join(dir, 'sgconfig.yml'), 'ruleDirs:\n  - rules\n')
    const result = await applyAstGrep({ cwd: dir, autoAccept: true })
    expect(result.updated).toEqual(['sgconfig.yml'])
    expect(readFileSync(join(dir, 'sgconfig.yml'), 'utf-8')).toContain('@pleaseai/ast-grep-config/rules')
  })
})

// ---------------------------------------------------------------------------
// editorconfig
// ---------------------------------------------------------------------------

describe('editorconfig tool', () => {
  test('the package it installs is publishable and ships .editorconfig', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, '../../editorconfig/package.json'), 'utf-8')) as { private?: boolean, files?: string[] }
    expect(pkg.private).toBeUndefined()
    expect(pkg.files).toContain('.editorconfig')
  })

  test('copies .editorconfig from node_modules', async () => {
    mkdirSync(join(dir, 'node_modules', '@pleaseai', 'editorconfig'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', '@pleaseai', 'editorconfig', '.editorconfig'), 'root = true\n')
    const result = await findTool('editorconfig')!.apply({ cwd: dir, autoAccept: true })
    expect(result.created).toEqual(['.editorconfig'])
    expect(readFileSync(join(dir, '.editorconfig'), 'utf-8')).toBe('root = true\n')
  })

  test('skips with a warning under Yarn Plug\'n\'Play, where node_modules does not exist', async () => {
    writeFileSync(join(dir, '.pnp.cjs'), '')
    const warn = spyOn(log, 'warn').mockImplementation(() => {})
    try {
      const result = await findTool('editorconfig')!.apply({ cwd: dir, autoAccept: true })
      expect(result).toEqual({ created: [], updated: [], skipped: ['.editorconfig'] })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('yarn node -e'))
    }
    finally {
      warn.mockRestore()
    }
  })

  test('does not warn under Plug\'n\'Play when .editorconfig already exists', async () => {
    writeFileSync(join(dir, '.pnp.cjs'), '')
    writeFileSync(join(dir, '.editorconfig'), 'root = true\n')
    const warn = spyOn(log, 'warn').mockImplementation(() => {})
    try {
      await findTool('editorconfig')!.apply({ cwd: dir, autoAccept: true })
      expect(warn).not.toHaveBeenCalled()
    }
    finally {
      warn.mockRestore()
    }
  })
})

// ---------------------------------------------------------------------------
// bun-lint-config
// ---------------------------------------------------------------------------

describe('bun-lint-config tool', () => {
  const lintToml = '[lint.rules]\nno-var = "error"\n'

  function installLintToml(contents = lintToml): void {
    mkdirSync(join(dir, 'node_modules', '@pleaseai', 'bun-lint-config'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', '@pleaseai', 'bun-lint-config', 'lint.toml'), contents)
  }

  function bunfig(): string {
    return readFileSync(join(dir, 'bunfig.toml'), 'utf-8')
  }

  test('installs the config package', () => {
    expect(findTool('bun-lint-config')?.packages).toEqual(['@pleaseai/bun-lint-config'])
  })

  test('is opt-in: init --yes applies every other tool but not this one', () => {
    expect(defaultToolIds()).toEqual(TOOLS.map(tool => tool.id).filter(id => id !== 'bun-lint-config'))
  })

  test('creates bunfig.toml with the lint tables in a managed block', async () => {
    installLintToml()
    const result = await applyBunLintConfig({ cwd: dir, autoAccept: true })
    expect(result.created).toEqual(['bunfig.toml'])
    expect(bunfig()).toStartWith('# >>> @pleaseai/bun-lint-config\n# Managed by @pleaseai/code-style')
    expect(bunfig()).toEndWith('[lint.rules]\nno-var = "error"\n# <<< @pleaseai/bun-lint-config\n')
  })

  test('appends the block to an existing bunfig.toml', async () => {
    installLintToml()
    writeFileSync(join(dir, 'bunfig.toml'), '[install]\nlinker = "hoisted"\n')
    const result = await applyBunLintConfig({ cwd: dir, autoAccept: true })
    expect(result.updated).toEqual(['bunfig.toml'])
    expect(bunfig()).toStartWith('[install]\nlinker = "hoisted"\n\n# >>> @pleaseai/bun-lint-config\n')
  })

  test('replaces an outdated block and leaves a current one alone', async () => {
    installLintToml()
    writeFileSync(join(dir, 'bunfig.toml'), '[install]\nlinker = "hoisted"\n')
    await applyBunLintConfig({ cwd: dir, autoAccept: true })
    installLintToml('[lint.rules]\nno-var = "warn"\n')
    expect((await applyBunLintConfig({ cwd: dir, autoAccept: true })).updated).toEqual(['bunfig.toml'])
    expect(bunfig()).toContain('no-var = "warn"')
    expect(bunfig()).not.toContain('no-var = "error"')
    expect(bunfig().match(/# >>> @pleaseai\/bun-lint-config/g)).toHaveLength(1)

    const current = bunfig()
    expect(await applyBunLintConfig({ cwd: dir, autoAccept: true })).toEqual({ created: [], updated: [], skipped: [] })
    expect(bunfig()).toBe(current)
  })

  test('skips with a warning when bunfig.toml already sets lint options outside the block', async () => {
    installLintToml()
    const warn = spyOn(log, 'warn').mockImplementation(() => {})
    try {
      for (const custom of ['[lint]\ntypeAware = true\n', '[ "lint" . rules ]\nno-var = "off"\n', '[[lint.overrides]]\nfiles = ["*.ts"]\n', 'lint.typeAware = true\n']) {
        writeFileSync(join(dir, 'bunfig.toml'), custom)
        const result = await applyBunLintConfig({ cwd: dir, autoAccept: true })
        expect(result).toEqual({ created: [], updated: [], skipped: ['bunfig.toml'] })
        expect(bunfig()).toBe(custom)
      }
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[lint]'))

      // A key named `lint` inside another table is not lint config.
      writeFileSync(join(dir, 'bunfig.toml'), '[run]\nlint = true\n')
      expect((await applyBunLintConfig({ cwd: dir, autoAccept: true })).updated).toEqual(['bunfig.toml'])
    }
    finally {
      warn.mockRestore()
    }
  })

  test('warns but still applies next to an ESLint config', async () => {
    installLintToml()
    const warn = spyOn(log, 'warn').mockImplementation(() => {})
    try {
      await applyBunLintConfig({ cwd: dir, autoAccept: true })
      expect(warn).not.toHaveBeenCalled()

      await applyBunLintConfig({ cwd: dir, autoAccept: true, selectedToolIds: ['eslint-config', 'bun-lint-config'] })
      expect(warn).toHaveBeenCalledTimes(1)

      writeFileSync(join(dir, 'eslint.config.mjs'), 'export default []\n')
      rmSync(join(dir, 'bunfig.toml'))
      const result = await applyBunLintConfig({ cwd: dir, autoAccept: true, selectedToolIds: ['bun-lint-config'] })
      expect(result.created).toEqual(['bunfig.toml'])
      expect(warn).toHaveBeenCalledTimes(2)
      expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('eslint.config.*'))
    }
    finally {
      warn.mockRestore()
    }
  })

  test('skips when the package is not installed, warning only under Plug\'n\'Play', async () => {
    const warn = spyOn(log, 'warn').mockImplementation(() => {})
    try {
      expect(await applyBunLintConfig({ cwd: dir, autoAccept: true })).toEqual({ created: [], updated: [], skipped: ['bunfig.toml'] })
      expect(warn).not.toHaveBeenCalled()

      writeFileSync(join(dir, '.pnp.cjs'), '')
      expect((await applyBunLintConfig({ cwd: dir, autoAccept: true })).skipped).toEqual(['bunfig.toml'])
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('yarn node -e'))
      expect(existsSync(join(dir, 'bunfig.toml'))).toBe(false)
    }
    finally {
      warn.mockRestore()
    }
  })
})

// ---------------------------------------------------------------------------
// AGENTS.md
// ---------------------------------------------------------------------------

describe('AGENTS.md rules block', () => {
  test('puts tests under the test root instead of next to the source', async () => {
    await applyAgentsMd({ cwd: dir, autoAccept: true })
    const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
    expect(body).not.toContain('colocate')
    expect(body).toContain('`src/foo/bar.ts` → `test/foo/bar.test.ts`')
    expect(body).toContain('node_modules/@pleaseai/ast-grep-config/README.md')
    expect(body).toContain('please-style check')
  })

  test('omits the ast-grep pointer unless ast-grep is selected or both its packages are already dependencies', async () => {
    await applyAgentsMd({ cwd: dir, autoAccept: true, selectedToolIds: ['agents-md'] })
    const bare = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
    expect(bare).not.toContain('please-style check')
    expect(bare).not.toContain('ast-grep-config')
    expect(bare).toContain('- Conventional Commits')

    await applyAgentsMd({ cwd: dir, autoAccept: true, selectedToolIds: ['agents-md', 'ast-grep'] })
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain('please-style check')

    // The pointer names the rules package's README, so the binary alone is not enough.
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { '@ast-grep/cli': '^0.45.3' } }))
    await applyAgentsMd({ cwd: dir, autoAccept: true, selectedToolIds: [] })
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).not.toContain('please-style check')

    writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { '@ast-grep/cli': '^0.45.3', '@pleaseai/ast-grep-config': '^0.0.1' } }))
    await applyAgentsMd({ cwd: dir, autoAccept: true, selectedToolIds: [] })
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain('please-style check')
  })
})
