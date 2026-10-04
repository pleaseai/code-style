import { describe, expect, test } from 'bun:test'
import { findingsFor } from '../test-utils/fixture.js'

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
