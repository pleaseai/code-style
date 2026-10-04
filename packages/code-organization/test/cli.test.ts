import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'bun:test'
import { createFixture } from './test-utils/fixture.js'

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url))

let cleanup = (): void => {}
afterEach(() => cleanup())

function run(files: Record<string, string>, args: string[]): { status: number | null, stdout: string, stderr: string } {
  const fixture = createFixture(files)
  cleanup = fixture.cleanup
  const res = spawnSync('bun', [CLI, ...args.map(a => a.replace('<root>', fixture.root))], { encoding: 'utf-8' })
  return { status: res.status, stdout: res.stdout, stderr: res.stderr }
}

const ORPHAN = { 'package.json': '{}', 'src/a.ts': '', 'test/b.test.ts': '' }

describe('please-code-org check', () => {
  test('warns but exits 0 by default (warn rollout)', () => {
    const res = run(ORPHAN, ['check', '<root>'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('test/b.test.ts: warning[test-path-derivable-from-source]')
    expect(res.stdout).toContain('1 code-organization warning.')
  })

  test('--strict exits 1 when there is any finding', () => {
    expect(run(ORPHAN, ['check', '<root>', '--strict']).status).toBe(1)
    expect(run({ 'package.json': '{}', 'src/a.ts': '', 'test/a.test.ts': '' }, ['check', '<root>', '--strict']).status).toBe(0)
  })

  test('--json prints the findings as JSON', () => {
    const res = run(ORPHAN, ['check', '<root>', '--json'])
    const parsed = JSON.parse(res.stdout) as { findings: Array<{ file: string, kind: string }>, notices: string[] }
    expect(parsed.findings).toEqual([expect.objectContaining({ file: 'test/b.test.ts', kind: 'orphan-test' })])
    expect(parsed.notices).toEqual([])
  })

  test('exits 2 on an unknown command or an invalid config', () => {
    expect(run(ORPHAN, ['lint', '<root>']).status).toBe(2)
    const bad = run({ ...ORPHAN, 'code-organization.json': '{"colocated":true}' }, ['check', '<root>'])
    expect(bad.status).toBe(2)
    expect(bad.stderr).toContain('unknown key "colocated"')
  })
})
