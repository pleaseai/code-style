import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { ConfigError } from '../../src/check/errors.js'
import { checkFixture, findingsFor } from '../test-utils/fixture.js'

const SLUG = 'test-path-derivable-from-source'
const PKG = { 'package.json': '{}' }

function files(findings: Array<{ file: string }>): string[] {
  return findings.map(f => f.file).sort()
}

describe('test-path-derivable-from-source (TypeScript)', () => {
  test('a test mirroring its source under a single root (root name stripped) passes', () => {
    const findings = findingsFor({
      ...PKG,
      'src/foo/bar.ts': 'export const bar = 1',
      'src/components/card.vue': '<template />',
      'test/foo/bar.test.ts': '',
      'test/components/card.spec.ts': '',
    }, SLUG)
    expect(findings).toEqual([])
  })

  test('accepts tests/ as the test root', () => {
    expect(findingsFor({ ...PKG, 'src/x.ts': '', 'tests/x.test.ts': '' }, SLUG)).toEqual([])
  })

  test('reports a test whose first segment is not an env name and whose mirror is missing', () => {
    const findings = findingsFor({ ...PKG, 'src/foo/bar.ts': '', 'test/wrong/bar.test.ts': '' }, SLUG)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'orphan-test', file: 'test/wrong/bar.test.ts', language: 'typescript', severity: 'warning' })
    expect(findings[0]?.message).toContain('src/wrong/bar.ts')
  })

  test('dual interpretation: src/unit/foo.ts ↔ test/unit/foo.test.ts passes as a mirrored path', () => {
    expect(findingsFor({ ...PKG, 'src/unit/foo.ts': '', 'test/unit/foo.test.ts': '' }, SLUG)).toEqual([])
  })

  test('dual interpretation: an env segment (test/unit/…) is skipped when deriving the source', () => {
    expect(findingsFor({ ...PKG, 'src/foo/bar.ts': '', 'test/unit/foo/bar.test.ts': '', 'test/nuxt/foo/bar.test.ts': '' }, SLUG)).toEqual([])
  })

  test('multiple source roots (Nuxt 4) keep the root segment: app/utils/x.ts and server/utils/x.ts', () => {
    const findings = findingsFor({
      ...PKG,
      'nuxt.config.ts': 'export default defineNuxtConfig({})',
      'app/utils/x.ts': '',
      'server/utils/x.ts': '',
      'test/unit/app/utils/x.test.ts': '',
      'test/unit/server/utils/x.test.ts': '',
      'test/unit/utils/x.test.ts': '',
    }, SLUG)
    expect(files(findings)).toEqual(['test/unit/utils/x.test.ts'])
  })

  test('tests under the e2e segment are not derived, and e2e tests outside the root are not reported', () => {
    expect(findingsFor({ ...PKG, 'src/a.ts': '', 'test/e2e/login.spec.ts': '', 'e2e/checkout.spec.ts': '' }, SLUG)).toEqual([])
  })

  test('reports a test file outside the test root', () => {
    const findings = findingsFor({ ...PKG, 'src/foo.ts': '', 'src/foo.test.ts': '' }, SLUG)
    expect(findings).toEqual([expect.objectContaining({ kind: 'test-outside-root', file: 'src/foo.test.ts' })])
  })

  test('never reports sources without tests', () => {
    expect(findingsFor({ ...PKG, 'src/a.ts': '', 'src/b/c.ts': '' }, SLUG)).toEqual([])
  })

  test('each monorepo package has its own test root', () => {
    const findings = findingsFor({
      ...PKG,
      'src/x.ts': '',
      'packages/a/package.json': '{}',
      'packages/a/src/y.ts': '',
      'packages/a/test/y.test.ts': '',
      'packages/a/test/x.test.ts': '',
    }, SLUG)
    expect(files(findings)).toEqual(['packages/a/test/x.test.ts'])
  })

  test('config can add env segments and source roots', () => {
    const findings = findingsFor({
      ...PKG,
      'code-organization.json': JSON.stringify({ envSegments: ['integration'], sourceRoots: ['lib'] }),
      'src/a.ts': '',
      'lib/b.ts': '',
      'test/integration/src/a.test.ts': '',
      'test/lib/b.test.ts': '',
      'test/a.test.ts': '',
    }, SLUG)
    // Two roots now: root names stay in the path, so test/a.test.ts no longer maps.
    expect(files(findings)).toEqual(['test/a.test.ts'])
  })

  test('--config replaces the root code-organization.json: an invalid root file is not read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'code-org-config-'))
    try {
      const configPath = join(dir, 'custom.json')
      writeFileSync(configPath, JSON.stringify({ envSegments: ['integration'] }))
      const result = () => checkFixture({ ...PKG, 'code-organization.json': '{', 'src/a.ts': '', 'test/a.test.ts': '' }, { configPath })
      expect(result).not.toThrow()
      expect(() => checkFixture({ ...PKG, 'code-organization.json': '{' })).toThrow(ConfigError)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a package.json under the enclosing test root is a fixture, not a unit', () => {
    const findings = findingsFor({
      ...PKG,
      'src/a.ts': '',
      'test/a.test.ts': '',
      'src/fixtures/basic/foo.ts': '',
      'test/fixtures/basic/package.json': '{}',
      'test/fixtures/basic/foo.test.ts': '',
    }, SLUG)
    expect(findings).toEqual([])
  })

  test('test files inside a fixture project are skipped with a notice, not reported as orphans', () => {
    const result = checkFixture({
      ...PKG,
      'src/a.ts': '',
      'test/a.test.ts': '',
      'test/fixtures/basic/package.json': '{}',
      'test/fixtures/basic/test/bar.test.ts': '',
      'test/fixtures/basic/baz.spec.ts': '',
      'test/orphan.test.ts': '',
    })
    expect(files(result.findings.filter(f => f.slug === SLUG))).toEqual(['test/orphan.test.ts'])
    expect(result.notices).toContain('TypeScript: test-path check skipped 2 test file(s) inside fixture projects (a package.json under a test root): test/fixtures/basic/baz.spec.ts, test/fixtures/basic/test/bar.test.ts')
  })

  test('config cannot opt out of the shape', () => {
    expect(() => checkFixture({ ...PKG, 'code-organization.json': JSON.stringify({ colocatedTests: true }) })).toThrow(ConfigError)
    expect(() => checkFixture({ ...PKG, 'code-organization.json': JSON.stringify({ sourceRoots: ['../outside'] }) })).toThrow(ConfigError)
    expect(() => checkFixture({ ...PKG, 'code-organization.json': JSON.stringify({ envSegments: ['a/b'] }) })).toThrow(ConfigError)
  })
})

describe('test-path-derivable-from-source (Dart, Kotlin, Java)', () => {
  test('dart: lib/ mirrors to test/ with _test.dart; orphans and tests outside test/ are reported', () => {
    const findings = findingsFor({
      'pubspec.yaml': 'name: app',
      'lib/src/auth/token_store.dart': '',
      'test/src/auth/token_store_test.dart': '',
      'test/src/auth/session_test.dart': '',
      'lib/src/auth/token_store_test.dart': '',
      'integration_test/app_test.dart': '',
    }, SLUG)
    expect(findings.map(f => [f.kind, f.file])).toEqual([
      ['test-outside-root', 'lib/src/auth/token_store_test.dart'],
      ['orphan-test', 'test/src/auth/session_test.dart'],
    ])
  })

  test('kotlin: src/main/kotlin mirrors to src/test/kotlin with Test.kt', () => {
    const findings = findingsFor({
      'app/src/main/kotlin/com/acme/Invoice.kt': '',
      'app/src/test/kotlin/com/acme/InvoiceTest.kt': '',
      'app/src/test/kotlin/com/acme/PaymentTest.kt': '',
      'app/src/main/kotlin/com/acme/RefundTest.kt': '',
    }, SLUG)
    expect(findings.map(f => [f.kind, f.file])).toEqual([
      ['test-outside-root', 'app/src/main/kotlin/com/acme/RefundTest.kt'],
      ['orphan-test', 'app/src/test/kotlin/com/acme/PaymentTest.kt'],
    ])
  })

  test('kotlin: a test may target a Java source in the module\'s src/main/java, and vice versa', () => {
    const findings = findingsFor({
      'src/main/java/com/x/Foo.java': '',
      'src/main/kotlin/com/x/Bar.kt': '',
      'src/test/kotlin/com/x/FooTest.kt': '',
      'src/test/java/com/x/BarTest.java': '',
      'src/test/kotlin/com/x/MissingTest.kt': '',
    }, SLUG)
    expect(files(findings)).toEqual(['src/test/kotlin/com/x/MissingTest.kt'])
  })

  test('java: src/main/java mirrors to src/test/java with Test.java', () => {
    const findings = findingsFor({
      'src/main/java/com/acme/Invoice.java': '',
      'src/test/java/com/acme/InvoiceTest.java': '',
      'src/test/java/com/acme/other/InvoiceTest.java': '',
    }, SLUG)
    expect(files(findings)).toEqual(['src/test/java/com/acme/other/InvoiceTest.java'])
  })
})

describe('test files outside any package', () => {
  test('are reported as one aggregated notice per language, never as findings', () => {
    const result = checkFixture({
      'b.test.ts': '',
      'a.test.ts': '',
      'tool/FooTest.kt': '',
      'app/foo_test.dart': '',
      'lib/helper.ts': '',
    })
    expect(result.findings).toEqual([])
    expect(result.notices).toEqual([
      'TypeScript: test-path check skipped 2 test file(s) outside any package (no package.json above them): a.test.ts, b.test.ts',
      'Dart: test-path check skipped 1 test file(s) outside any package (no pubspec.yaml above them): app/foo_test.dart',
      'Kotlin: test-path check skipped 1 test file(s) outside any package (not under a Gradle src/<set>/kotlin source set): tool/FooTest.kt',
    ])
  })

  test('a test file inside a package yields no such notice', () => {
    const result = checkFixture({ ...PKG, 'src/x.ts': '', 'test/x.test.ts': '' })
    expect(result.notices).toEqual([])
  })
})
