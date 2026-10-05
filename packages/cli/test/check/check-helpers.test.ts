import { describe, expect, test } from 'bun:test'
import { checkFixture, findingsFor } from '../test-utils/fixture.js'

const SLUG = 'test-helpers-in-dedicated-location'
const PKG = { 'package.json': '{}', 'src/user.ts': 'export const user = 1', 'src/order.ts': 'export const order = 1' }

describe('test-helpers-in-dedicated-location (TypeScript)', () => {
  test('reports a helper outside test-utils/ that two test files import', () => {
    const findings = findingsFor({
      ...PKG,
      'test/helpers.ts': 'export function mockUser() {}\nexport const unrelated = 1',
      'test/user.test.ts': 'import { mockUser } from \'./helpers\'',
      'test/order.test.ts': 'import { mockUser as m } from \'./helpers.js\'',
    }, SLUG)
    expect(findings).toEqual([expect.objectContaining({ kind: 'shared-helper-outside-location', file: 'test/helpers.ts', line: 1 })])
    expect(findings[0]?.message).toContain('test/test-utils/')
  })

  test.each(['ts', 'tsx'])('a helper exported under an alias is matched by the alias its importers use (.%s)', (ext) => {
    const findings = findingsFor({
      ...PKG,
      [`test/helpers.${ext}`]: 'class FakeClock {}\nexport { FakeClock as MockClock }',
      'test/user.test.ts': 'import { MockClock } from \'./helpers\'',
      'test/order.test.ts': 'import { MockClock } from \'./helpers\'',
    }, SLUG)
    expect(findings).toEqual([expect.objectContaining({ file: `test/helpers.${ext}`, line: 1 })])
  })

  test('resolves `.mjs` imports to `.mts` even when a same-named `.ts` exists', () => {
    const findings = findingsFor({
      ...PKG,
      'test/support.ts': 'export function mockUser() {}',
      'test/support.mts': 'export function mockUser() {}',
      'test/user.test.ts': 'import { mockUser } from \'./support.mjs\'',
      'test/order.test.ts': 'import { mockUser } from \'./support.mjs\'',
    }, SLUG)
    expect(findings.map(f => f.file)).toEqual(['test/support.mts'])
  })

  test('points the message at the test root the helper lives in', () => {
    const findings = findingsFor({
      ...PKG,
      'tests/helpers.ts': 'export function mockUser() {}',
      'tests/user.test.ts': 'import { mockUser } from \'./helpers\'',
      'tests/order.test.ts': 'import { mockUser } from \'./helpers\'',
    }, SLUG)
    expect(findings[0]?.message).toContain('tests/test-utils/')
  })

  test('counts namespace imports as importing every helper', () => {
    expect(findingsFor({
      ...PKG,
      'test/fakes.ts': 'export const fakeClock = {}',
      'test/user.test.ts': 'import * as fakes from \'./fakes\'',
      'test/order.test.ts': 'import { fakeClock } from \'./fakes\'',
    }, SLUG)).toHaveLength(1)
  })

  test('a helper already in <test-root>/test-utils/ is not reported', () => {
    expect(findingsFor({
      ...PKG,
      'test/test-utils/mocks.ts': 'export function createMockUser() {}',
      'test/user.test.ts': 'import { createMockUser } from \'../test-utils/mocks\'',
      'test/order.test.ts': 'import { createMockUser } from \'../test-utils/mocks\'',
    }, SLUG)).toEqual([])
  })

  test('a local helper used by one test file is not reported', () => {
    expect(findingsFor({
      ...PKG,
      'test/user.test.ts': 'function mockResponse() {}\nexport function stubFetch() {}',
      'test/order.test.ts': 'import { stubFetch } from \'./user.test\'',
    }, SLUG)).toEqual([])
  })
})

describe('test-helpers-in-dedicated-location (TypeScript regressions)', () => {
  test('a namespace import does not credit a private helper declaration', () => {
    expect(findingsFor({
      ...PKG,
      'test/helpers.ts': 'function mockPrivate() {}\nexport const unrelated = 1',
      'test/user.test.ts': 'import * as helpers from \'./helpers\'',
      'test/order.test.ts': 'import * as helpers from \'./helpers\'',
    }, SLUG)).toEqual([])
  })

  test('a private declaration is not credited by imports of an unrelated export of the same name', () => {
    expect(findingsFor({
      ...PKG,
      'test/helpers.ts': 'class MockThing {}\nclass Other {}\nexport { Other as MockThing }',
      'test/user.test.ts': 'import { MockThing } from \'./helpers\'',
      'test/order.test.ts': 'import * as h from \'./helpers\'',
      'test/extra.test.ts': 'import { MockThing } from \'./helpers\'',
    }, SLUG)).toEqual([])
  })

  test('files inside a fixture project are neither helpers nor importers', () => {
    expect(findingsFor({
      ...PKG,
      'test/fixtures/proj/package.json': '{}',
      'test/fixtures/proj/src/api.ts': 'export function mockApi() {}',
      'test/fixtures/proj/test/a.test.ts': 'import { mockApi } from \'../src/api\'',
      'test/fixtures/proj/test/b.test.ts': 'import { mockApi } from \'../src/api\'',
    }, SLUG)).toEqual([])
  })

  test.each(['ts', 'tsx'])('an exported abstract class helper imported by two tests is reported (.%s)', (ext) => {
    const findings = findingsFor({
      ...PKG,
      [`test/support.${ext}`]: 'export abstract class MockThing {}',
      'test/user.test.ts': 'import { MockThing } from \'./support\'',
      'test/order.test.ts': 'import { MockThing } from \'./support\'',
    }, SLUG)
    expect(findings).toEqual([expect.objectContaining({ file: `test/support.${ext}`, line: 1 })])
  })
})

describe('test-helpers-in-dedicated-location (Dart, Kotlin, Java)', () => {
  test('dart: a test/ library outside test/helpers/ imported by two tests is reported; show lists are honored', () => {
    const findings = findingsFor({
      'pubspec.yaml': 'name: app',
      'lib/a.dart': '',
      'lib/b.dart': '',
      'test/support/mocks.dart': 'class MockClient {}\nMockClient mockClient() => MockClient();',
      'test/a_test.dart': 'import \'support/mocks.dart\';',
      'test/b_test.dart': 'import \'../test/support/mocks.dart\' show mockClient;',
    }, SLUG)
    expect(findings.map(f => `${f.file}:${f.line}`)).toEqual(['test/support/mocks.dart:2'])
  })

  test('dart: successive show clauses or repeated imports of one library are withheld with a notice', () => {
    const base = { 'pubspec.yaml': 'name: app', 'lib/a.dart': '', 'test/support.dart': 'class MockClient {}\nclass Other {}' }
    const successive = checkFixture({
      ...base,
      'test/a_test.dart': 'import \'support.dart\' show MockClient show Other;',
      'test/b_test.dart': 'import \'support.dart\' show MockClient show Other;',
    })
    expect(successive.findings.filter(f => f.slug === SLUG)).toEqual([])
    expect(successive.notices).toEqual([expect.stringContaining('Dart: helper check withheld judgement for 2 test file(s)')])
    const repeated = checkFixture({
      ...base,
      'test/a_test.dart': 'import \'support.dart\' hide MockClient;\nimport \'support.dart\' show MockClient;',
      'test/b_test.dart': 'import \'support.dart\';',
      'test/c_test.dart': 'import \'support.dart\';',
    })
    expect(repeated.findings.filter(f => f.slug === SLUG).map(f => f.file)).toEqual(['test/support.dart'])
    expect(repeated.notices).toEqual([expect.stringContaining('withheld judgement for 1 test file(s)')])
  })

  test('shared helpers outside any package are withheld with an aggregated notice', () => {
    const result = checkFixture({
      'scripts/a.test.ts': 'export function mockUser() {}',
      'scripts/b.test.ts': 'import { mockUser } from \'./a.test\'',
      'scripts/c.test.ts': 'import { mockUser } from \'./a.test\'',
    })
    expect(result.findings.filter(f => f.slug === SLUG)).toEqual([])
    expect(result.notices).toContain('TypeScript: helper check skipped 1 shared helper file(s) outside any package (no package.json above them): scripts/a.test.ts')
  })

  test('kotlin: a private top-level helper is not shared across files', () => {
    const findings = findingsFor({
      'src/main/kotlin/com/acme/Invoice.kt': 'package com.acme',
      'src/test/kotlin/com/acme/InvoiceTest.kt': 'package com.acme\nclass InvoiceTest { val c = mockClock() }',
      'src/test/kotlin/com/acme/PaymentTest.kt': 'package com.acme\nclass PaymentTest { val c = mockClock() }',
      'src/test/kotlin/com/acme/Support.kt': 'package com.acme\nprivate fun mockClock() = 1\nprivate class FakeBox',
    }, SLUG)
    expect(findings).toEqual([])
  })

  test('dart: a top-level typedef counts as a helper', () => {
    const findings = findingsFor({
      'pubspec.yaml': 'name: app',
      'lib/a.dart': '',
      'test/support.dart': 'typedef MockFactory = Object Function();',
      'test/a_test.dart': 'import \'support.dart\';',
      'test/b_test.dart': 'import \'support.dart\';',
    }, SLUG)
    expect(findings.map(f => `${f.file}:${f.line}`)).toEqual(['test/support.dart:1'])
  })

  test('dart: a hide list removes the helper from that importer', () => {
    const findings = findingsFor({
      'pubspec.yaml': 'name: app',
      'lib/a.dart': '',
      'lib/b.dart': '',
      'test/support/mocks.dart': 'class MockClient {}',
      'test/a_test.dart': 'import \'support/mocks.dart\' hide MockClient;',
      'test/b_test.dart': 'import \'support/mocks.dart\' hide MockClient;',
    }, SLUG)
    expect(findings).toEqual([])
  })

  test('dart: test/helpers/ is the designated location', () => {
    expect(findingsFor({
      'pubspec.yaml': 'name: app',
      'lib/a.dart': '',
      'lib/b.dart': '',
      'test/helpers/mocks.dart': 'class MockClient {}',
      'test/a_test.dart': 'import \'helpers/mocks.dart\';',
      'test/b_test.dart': 'import \'helpers/mocks.dart\';',
    }, SLUG)).toEqual([])
  })

  test('kotlin: a same-package helper used by two tests is reported unless it is in src/testFixtures/', () => {
    const tests = {
      'src/main/kotlin/com/acme/Invoice.kt': 'package com.acme',
      'src/main/kotlin/com/acme/Payment.kt': 'package com.acme',
      'src/test/kotlin/com/acme/InvoiceTest.kt': 'package com.acme\nclass InvoiceTest { val c = FakeClock() }',
      'src/test/kotlin/com/acme/PaymentTest.kt': 'package com.acme\nclass PaymentTest { val c = FakeClock() }',
    }
    const outside = findingsFor({ ...tests, 'src/test/kotlin/com/acme/FakeClock.kt': 'package com.acme\nclass FakeClock' }, SLUG)
    expect(outside.map(f => f.file)).toEqual(['src/test/kotlin/com/acme/FakeClock.kt'])
    const fixtures = findingsFor({ ...tests, 'src/testFixtures/kotlin/com/acme/FakeClock.kt': 'package com.acme\nclass FakeClock' }, SLUG)
    expect(fixtures).toEqual([])
  })

  test('kotlin: same-named helpers in separate modules are not counted together', () => {
    const module = (name: string, tests: string[]): Record<string, string> => Object.fromEntries([
      [`${name}/build.gradle.kts`, ''],
      [`${name}/src/main/kotlin/com/acme/Main.kt`, 'package com.acme'],
      [`${name}/src/test/kotlin/com/acme/FakeClock.kt`, 'package com.acme\nclass FakeClock'],
      ...tests.map(t => [`${name}/src/test/kotlin/com/acme/${t}Test.kt`, `package com.acme\nclass ${t}Test { val c = FakeClock() }`]),
    ])
    expect(findingsFor({ ...module('a', ['One']), ...module('b', ['Two']) }, SLUG)).toEqual([])
  })

  test('dart: a fixture project under test/ is neither helper nor importer', () => {
    expect(findingsFor({
      'pubspec.yaml': 'name: app',
      'lib/a.dart': '',
      'test/fixtures/proj/pubspec.yaml': 'name: proj',
      'test/fixtures/proj/test/mocks.dart': 'class MockClient {}',
      'test/fixtures/proj/test/a_test.dart': 'import \'mocks.dart\';',
      'test/fixtures/proj/test/b_test.dart': 'import \'mocks.dart\';',
    }, SLUG)).toEqual([])
  })

  test('mixed module: Kotlin tests importing a Java helper, and Java tests importing a Kotlin helper, are counted', () => {
    const main = { 'src/main/kotlin/com/acme/Invoice.kt': 'package com.acme', 'src/main/java/com/acme/Payment.java': 'package com.acme;' }
    const javaHelper = findingsFor({
      ...main,
      'src/test/java/com/acme/support/MockClock.java': 'package com.acme.support;\npublic class MockClock {}',
      'src/test/kotlin/com/acme/InvoiceTest.kt': 'package com.acme\nimport com.acme.support.MockClock',
      'src/test/kotlin/com/acme/PaymentTest.kt': 'package com.acme\nimport com.acme.support.MockClock',
    }, SLUG)
    expect(javaHelper.map(f => f.file)).toEqual(['src/test/java/com/acme/support/MockClock.java'])
    const kotlinHelper = findingsFor({
      ...main,
      'src/test/kotlin/com/acme/support/FakeClock.kt': 'package com.acme.support\nclass FakeClock',
      'src/test/java/com/acme/InvoiceTest.java': 'package com.acme;\nimport com.acme.support.FakeClock;',
      'src/test/java/com/acme/PaymentTest.java': 'package com.acme;\nimport com.acme.support.FakeClock;',
    }, SLUG)
    expect(kotlinHelper.map(f => f.file)).toEqual(['src/test/kotlin/com/acme/support/FakeClock.kt'])
  })

  test('java: an imported helper used by two tests is reported', () => {
    const findings = findingsFor({
      'src/main/java/com/acme/Invoice.java': 'package com.acme;',
      'src/main/java/com/acme/Payment.java': 'package com.acme;',
      'src/test/java/com/acme/support/FakeGateway.java': 'package com.acme.support;\npublic class FakeGateway {}',
      'src/test/java/com/acme/InvoiceTest.java': 'package com.acme;\nimport com.acme.support.FakeGateway;\nclass InvoiceTest {}',
      'src/test/java/com/acme/PaymentTest.java': 'package com.acme;\nimport com.acme.support.*;\nclass PaymentTest {}',
    }, SLUG)
    expect(findings.map(f => f.file)).toEqual(['src/test/java/com/acme/support/FakeGateway.java'])
  })
})
