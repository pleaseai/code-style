import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { applyAgentsMd, applyAstGrep, findTool } from '../src/appliers.js'

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

  test('overwrites a different sgconfig.yml when overwrites are accepted', async () => {
    writeFileSync(join(dir, 'sgconfig.yml'), 'ruleDirs:\n  - rules\n')
    const result = await applyAstGrep({ cwd: dir, autoAccept: true })
    expect(result.updated).toEqual(['sgconfig.yml'])
    expect(readFileSync(join(dir, 'sgconfig.yml'), 'utf-8')).toContain('@pleaseai/ast-grep-config/rules')
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
})
