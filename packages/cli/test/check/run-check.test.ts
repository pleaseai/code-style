import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'
import { createFixture } from '../test-utils/fixture.js'

const CLI = fileURLToPath(new URL('../../src/index.ts', import.meta.url))

function run(files: Record<string, string>, args: string[]): { status: number | null, stdout: string, stderr: string } {
  const fixture = createFixture(files)
  try {
    // English messages whatever the machine's locale.
    const env = { ...process.env, LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8', LC_MESSAGES: 'en_US.UTF-8' }
    const res = spawnSync('bun', [CLI, ...args.map(a => a.replace('<root>', fixture.root))], { encoding: 'utf-8', env })
    return { status: res.status, stdout: res.stdout, stderr: res.stderr }
  }
  finally {
    fixture.cleanup()
  }
}

const ORPHAN = { 'package.json': '{}', 'src/a.ts': '', 'test/b.test.ts': '' }

describe('please-style check', () => {
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

  test('prints its own usage for check --help and is listed in the global usage', () => {
    const own = run(ORPHAN, ['check', '--help'])
    expect(own.status).toBe(0)
    expect(own.stdout).toContain('please-style check [path] [options]')
    expect(own.stdout).toContain('2 usage or config error, or a dependency that cannot be resolved')
    const global = run(ORPHAN, ['--help'])
    expect(global.status).toBe(0)
    expect(global.stdout).toMatch(/^ {2}check {6}/m)
  })

  test('exits 2 on an unknown flag, extra arguments, or an invalid config', () => {
    const flag = run(ORPHAN, ['check', '<root>', '--fix'])
    expect(flag.status).toBe(2)
    expect(flag.stderr).toContain('--fix')
    expect(run(ORPHAN, ['check', '<root>', 'extra']).status).toBe(2)
    const bad = run({ ...ORPHAN, 'code-organization.json': '{"colocated":true}' }, ['check', '<root>'])
    expect(bad.status).toBe(2)
    expect(bad.stderr).toContain('unknown key "colocated"')
  })

  test('exits 2 on a check option placed before `check` instead of dropping it', () => {
    const res = run(ORPHAN, ['--strict', 'check', '<root>'])
    expect(res.status).toBe(2)
    expect(res.stderr).toContain('--strict is a check option')
    expect(run(ORPHAN, ['--lang', 'en', 'check', '<root>']).status).toBe(0)
  })
})
