import { describe, expect, test } from 'bun:test'
import { findingsFor } from '../test-utils/fixture.js'

const SLUG = 'code-filename-matches-primary-symbol'
const PKG = { 'package.json': '{}' }

describe('code-filename-matches-primary-symbol (TypeScript)', () => {
  test('a file whose only export matches its kebab-cased name passes', () => {
    expect(findingsFor({
      ...PKG,
      'src/user-service.ts': 'export class UserService {}',
      'src/parse-url.ts': 'export function parseURL() {}',
      'src/composables/useCounter.ts': 'export function useCounter() {}',
      'src/user.service.ts': 'export const UserService = 1',
    }, SLUG)).toEqual([])
  })

  test('reports a single-export file named after something else, with the expected name', () => {
    const findings = findingsFor({ ...PKG, 'src/loader.ts': 'const x = 1\nexport function parseConfig() {}' }, SLUG)
    expect(findings).toEqual([expect.objectContaining({ kind: 'filename-mismatch', file: 'src/loader.ts', line: 2 })])
    expect(findings[0]?.message).toContain('parse-config.ts')
  })

  test('files with several public symbols, or none, are not checked', () => {
    expect(findingsFor({
      ...PKG,
      'src/util.ts': 'export function a() {}\nexport type B = string',
      'src/side-effect.ts': 'console.warn(1)',
    }, SLUG)).toEqual([])
  })

  test('errors.ts, index.ts, config files and test-root files are exempt', () => {
    expect(findingsFor({
      ...PKG,
      'src/errors.ts': 'export class NotFoundError extends Error {}',
      'src/index.ts': 'export function main() {}',
      'vite.config.ts': 'export const plugins = []',
      'test/test-utils/fixture.ts': 'export function createFixture() {}',
    }, SLUG)).toEqual([])
  })
  test('framework route files and ambient/aliased-default exports are not mismatches', () => {
    expect(findingsFor({
      ...PKG,
      'app/api/users/route.ts': 'export function GET() {}',
      'src/middleware.ts': 'export function handle() {}',
      'src/routes/+server.ts': 'export function GET() {}',
      'src/ambient.ts': 'export function foo() {}\nexport declare const version: string;',
      'src/aliased.ts': 'export function foo() {}\nexport { foo as default }',
    }, SLUG)).toEqual([])
  })
})

describe('code-filename-matches-primary-symbol (TypeScript exports)', () => {
  test('a namespace is the primary symbol, not its members', () => {
    expect(findingsFor({
      ...PKG,
      'src/api.ts': 'export namespace Api { export class User {} }',
      'src/billing.ts': 'export namespace Billing { export class A {}\nexport class B {} }',
    }, SLUG)).toEqual([])
    const findings = findingsFor({ ...PKG, 'src/api.ts': 'export namespace Billing { export class User {} }' }, SLUG)
    expect(findings[0]?.message).toContain('billing.ts')
  })

  test('destructured exports make the symbol set unknown, so the file is not checked', () => {
    expect(findingsFor({
      ...PKG,
      'src/mixed.ts': 'export function foo() {}\nexport const { bar } = obj',
      'src/only-pattern.ts': 'export const [first] = list',
      'src/tsx-mixed.tsx': 'export function Foo() {}\nexport const { bar } = obj',
    }, SLUG)).toEqual([])
  })

  test('re-exports and default exports make the symbol set unknown, so the file is not checked', () => {
    expect(findingsFor({
      ...PKG,
      'src/api.ts': 'export function createClient() {}\nexport * from \'./types\'',
      'src/named.ts': 'export function good() {}\nexport { other } from \'./other\'',
      'src/ns.ts': 'export function good() {}\nexport * as ns from \'./other\'',
      'server/api/foo.ts': 'export default defineEventHandler(() => 1)\nexport const schema = 1',
    }, SLUG)).toEqual([])
  })

  test('files under hidden directories are scanned', () => {
    const findings = findingsFor({ ...PKG, 'src/.hidden/mixed.ts': 'export function good() {}' }, SLUG)
    expect(findings.map(f => f.file)).toEqual(['src/.hidden/mixed.ts'])
  })

  test('declaration files of every module flavor are exempt', () => {
    expect(findingsFor({
      ...PKG,
      'src/types.d.mts': 'export declare class User {}',
      'src/types.d.cts': 'export declare class User {}',
      'src/types.d.ts': 'export declare class User {}',
    }, SLUG)).toEqual([])
  })
})

describe('code-filename-matches-primary-symbol (Dart)', () => {
  const PUBSPEC = { 'pubspec.yaml': 'name: app' }

  test('a file whose only public declaration matches its snake_cased name passes', () => {
    expect(findingsFor({
      ...PUBSPEC,
      'lib/user_repository.dart': 'class UserRepository {}\nclass _Cache {}',
    }, SLUG)).toEqual([])
  })

  test('reports a mismatch with the snake_case file name to use', () => {
    const findings = findingsFor({ ...PUBSPEC, 'lib/repo.dart': 'class UserRepository {}' }, SLUG)
    expect(findings).toEqual([expect.objectContaining({ language: 'dart', file: 'lib/repo.dart', line: 1 })])
    expect(findings[0]?.message).toContain('user_repository.dart')
  })

  test('errors.dart, part files and generated files are exempt', () => {
    expect(findingsFor({
      ...PUBSPEC,
      'lib/errors.dart': 'class AuthException implements Exception {}',
      'lib/model.g.dart': 'class Generated {}',
      'lib/part_a.dart': 'part of \'model.dart\';\nclass Other {}',
    }, SLUG)).toEqual([])
  })

  test('Dart entrypoints under bin/, tool/, example/ and web/ are exempt', () => {
    expect(findingsFor({
      ...PUBSPEC,
      'bin/my_cli.dart': 'void main() {}',
      'tool/gen.dart': 'void main() {}',
      'example/demo.dart': 'void main() {}',
      'web/app.dart': 'void main() {}',
    }, SLUG)).toEqual([])
  })
})
