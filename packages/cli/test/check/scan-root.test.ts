import { describe, expect, test } from 'bun:test'
import { scopeResult } from '../../src/check/scan-root.js'
import { checkFixture } from '../test-utils/fixture.js'

const PACKAGE = {
  'package.json': '{}',
  'src/foo.ts': 'export const foo = 1\n',
  'src/a.ts': '',
  'src/b.ts': '',
  'src/foo.test.ts': '',
  'test/foo.test.ts': '',
  'test/test-utils/shared.ts': 'export const shared = 1\n',
  'test/a.test.ts': 'import { shared } from \'./test-utils/shared.js\'\n',
  'test/b.test.ts': 'import { shared } from \'./test-utils/shared.js\'\n',
}

describe('scan root', () => {
  test('checking src/ discovers the package above it and reports test-outside-root', () => {
    const result = checkFixture(PACKAGE, {}, 'src')
    expect(result.findings).toEqual([expect.objectContaining({ kind: 'test-outside-root', file: 'foo.test.ts' })])
  })

  test('checking test/ keeps the test-root context', () => {
    const files = { ...PACKAGE, 'test/orphan.test.ts': '', 'test/helpers.ts': 'export function mockUser() {}\nexport const unrelated = 1' }
    const importLoose = 'import { mockUser } from \'./helpers\''
    const result = checkFixture({ ...files, 'test/a.test.ts': importLoose, 'test/b.test.ts': importLoose }, {}, 'test')
    // mirrored tests are not orphans, a helper under test-utils is fine, a loose shared helper is flagged
    expect(result.findings.map(f => `${f.kind}:${f.file}`)).toEqual(['shared-helper-outside-location:helpers.ts', 'orphan-test:orphan.test.ts'])
  })

  test('findings of a sibling directory are not reported', () => {
    const files = { ...PACKAGE, 'test/orphan.test.ts': '' }
    expect(checkFixture(files, {}, 'src').findings.map(f => f.file)).toEqual(['foo.test.ts'])
    expect(checkFixture(files, {}, 'test').findings.map(f => f.file)).toEqual(['orphan.test.ts'])
  })

  test('without a project marker above, the requested directory is the whole world', () => {
    const result = checkFixture({ 'src/foo.test.ts': '' }, {}, 'src')
    expect(result.findings).toEqual([])
    expect(result.notices.some(n => n.includes('foo.test.ts'))).toBe(true)
  })

  test('the outermost marker wins so a nested package resolves as from the top', () => {
    const files = { 'package.json': '{}', 'packages/a/package.json': '{}', 'packages/a/src/x.ts': '', 'packages/a/test/x.test.ts': '', 'packages/a/test/y.test.ts': '' }
    expect(checkFixture(files, {}, 'packages/a/test').findings).toEqual([expect.objectContaining({ kind: 'orphan-test', file: 'y.test.ts' })])
  })
})

describe('scopeResult notices', () => {
  const notices = [
    'TypeScript: test-path check skipped 1 test file(s) outside any package (package.json): src/a.test.ts',
    'TypeScript: test-path check skipped 1 test file(s) outside any package (package.json): test/b.test.ts',
    'Rust: test-path and helper checks skipped: cargo is not available (x).',
  ]

  test('keeps notices that list a path below the directory or list none', () => {
    const scoped = scopeResult({ root: '/r', findings: [], notices }, '/r', '/r/src')
    expect(scoped.notices).toEqual([notices[0], notices[2]])
  })

  test('keeps a notice whose path contains a space, names the directory with a trailing slash, or carries an absolute diagnostic path', () => {
    const kept = [
      'TypeScript: filename check skipped 1 file(s): src/my folder/a.ts',
      'Rust: checks skipped for 1 crate(s) using include! (from src/my folder/lib.rs): src/my folder/',
      'Rust: test-path and helper checks skipped: cargo metadata failed (/usr/local/bin/cargo: exit 101).',
    ]
    const dropped = 'TypeScript: filename check skipped 1 file(s): lib/other.ts'
    const scoped = scopeResult({ root: '/r', findings: [], notices: [...kept, dropped] }, '/r', '/r/src/my folder')
    expect(scoped.notices).toEqual(kept)
  })
})
