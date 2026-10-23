import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { log } from '@clack/prompts'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { applyAgentsMd, applyAstGrep, findTool } from '../src/appliers.js'
import { LANGUAGES } from '../src/languages.js'

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
// AGENTS.md
// ---------------------------------------------------------------------------

describe('AGENTS.md rules block', () => {
  beforeEach(() => {
    writeFileSync(join(dir, 'package.json'), '{}')
  })

  test('puts tests under the test root instead of next to the source', async () => {
    await applyAgentsMd({ cwd: dir, autoAccept: true })
    const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
    expect(body).not.toContain('colocate')
    expect(body).toContain('`src/foo/bar.ts` → `test/foo/bar.test.ts`')
    expect(body).toContain('node_modules/@pleaseai/ast-grep-config/README.md')
    expect(body).toContain('please-style check')
  })

  test('titles the block Passion Factory Code Style', async () => {
    await applyAgentsMd({ cwd: dir, autoAccept: true })
    const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
    expect(body).toContain('<!-- pleaseai-code-style:start -->\n# Passion Factory Code Style\n')
    expect(body).not.toContain('PleaseAI Code Style')
  })

  test('points only at rule files the package ships', async () => {
    await applyAgentsMd({ cwd: dir, autoAccept: true })
    const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
    const linked = [...body.matchAll(/node_modules\/@pleaseai\/code-style\/([\w./-]+\.md)/g)].map(m => m[1])
    expect(linked).toEqual(['rules/general.md', 'rules/typescript.md'])

    const pkgRoot = join(import.meta.dir, '..')
    const { files } = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8')) as { files: string[] }
    for (const path of linked) {
      expect(existsSync(join(pkgRoot, path))).toBe(true)
      expect(files.some(entry => path === entry || path.startsWith(`${entry}/`))).toBe(true)
    }
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

  test('links the selected languages and drops the TypeScript bullets when typescript is not selected', async () => {
    await applyAgentsMd({ cwd: dir, autoAccept: true, languages: ['dart', 'rust'] })
    const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
    const linked = [...body.matchAll(/node_modules\/@pleaseai\/code-style\/([\w./-]+\.md)/g)].map(m => m[1])
    expect(linked).toEqual(['rules/general.md', 'rules/dart.md', 'rules/rust.md'])
    expect(body).not.toContain('@pleaseai/eslint-config')
    expect(body).not.toContain('ESM only')
    expect(body).not.toContain('import.meta.vitest')
    expect(body).toContain('- File size target')
    expect(body).toContain('- Conventional Commits')
  })

  test('keeps the languages of the existing block when none are given, even if detection differs', async () => {
    await applyAgentsMd({ cwd: dir, autoAccept: true, languages: ['dart'] })
    await applyAgentsMd({ cwd: dir, autoAccept: true })
    const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
    expect(body).toContain('rules/dart.md')
    expect(body).not.toContain('rules/typescript.md')
  })

  test('ships a guide for every language, covered by the package files', () => {
    const pkgRoot = join(import.meta.dir, '..')
    const { files } = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8')) as { files: string[] }
    for (const id of LANGUAGES) {
      const path = `rules/${id}.md`
      expect(existsSync(join(pkgRoot, path))).toBe(true)
      expect(files.some(entry => path.startsWith(`${entry}/`))).toBe(true)
    }
  })
})
