import { describe, expect, test } from 'bun:test'
import { checkFixture, findingsFor } from '../test-utils/fixture.js'

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

  test('acronym symbols match a file name that does not split the acronym', () => {
    expect(findingsFor({
      ...PKG,
      'src/graphql-client.ts': 'export class GraphQLClient {}',
      'src/oauth2-client.ts': 'export class OAuth2Client {}',
    }, SLUG)).toEqual([])
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
  test.each(['ts', 'tsx'])('`export { x }` of an imported binding is a re-export, not a local symbol (.%s)', (ext) => {
    const result = checkFixture({
      ...PKG,
      'src/foo.ts': 'export function foo() {}',
      [`src/bar.${ext}`]: 'import { foo } from \'./foo\'\nexport { foo }',
      'src/baz.ts': 'import def from \'./foo\'\nimport * as ns from \'./foo\'\nimport { a as renamed } from \'./foo\'\nexport { renamed }',
    })
    expect(result.findings.filter(f => f.slug === SLUG)).toEqual([])
    expect(result.notices.join('\n')).toContain('re-export')
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

  test.each(['ts', 'tsx'])('a dotted namespace counts as its outermost name (.%s)', (ext) => {
    expect(findingsFor({ ...PKG, [`src/foo.${ext}`]: 'export namespace Foo.Bar { export class A {} }' }, SLUG)).toEqual([])
    const findings = findingsFor({ ...PKG, [`src/run.${ext}`]: 'export namespace Foo.Bar.Baz {}\nexport function run() {}\nnamespace Hidden.X {}' }, SLUG)
    expect(findings).toEqual([])
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

  test.each(['ts', 'tsx'])('a default export with a comment between `export` and `default` still withholds judgement (.%s)', (ext) => {
    expect(findingsFor({
      ...PKG,
      [`src/foo.${ext}`]: 'export /* c */ default function foo() {}\nexport const bar = 1',
    }, SLUG)).toEqual([])
  })

  test('string-literal export aliases make the symbol set unknown, so the file is not checked', () => {
    expect(findingsFor({
      ...PKG,
      'src/alias.ts': 'export const foo = 1\nexport { foo as "another" }',
      'src/alias.tsx': 'export const foo = 1\nexport { foo as "another" }',
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

  test('a legacy function typedef is extracted by its name', () => {
    const findings = findingsFor({ ...PUBSPEC, 'lib/other.dart': 'typedef void Callback(int value);\nclass Widget {}' }, SLUG)
    expect(findings).toEqual([])
    expect(findingsFor({ ...PUBSPEC, 'lib/callback.dart': 'typedef void Callback(int value);' }, SLUG)).toEqual([])
  })

  test('errors.dart, part files and generated files are exempt', () => {
    expect(findingsFor({
      ...PUBSPEC,
      'lib/errors.dart': 'class AuthException implements Exception {}',
      'lib/model.g.dart': 'class Generated {}',
      'lib/part_a.dart': 'part of \'model.dart\';\nclass Other {}',
    }, SLUG)).toEqual([])
  })

  test('a library that re-exports others has an unknown symbol set, so it is not checked', () => {
    expect(findingsFor({
      ...PUBSPEC,
      'lib/api.dart': 'export \'other.dart\';\nclass Foo {}',
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

describe('unsupported-syntax notices', () => {
  const PUBSPEC = { 'pubspec.yaml': 'name: app' }

  test('TypeScript files with unenumerable exports yield one aggregated notice, without findings', () => {
    const result = checkFixture({
      ...PKG,
      'src/barrel.ts': 'export * from \'./a\'\nexport function one() {}',
      'src/dflt.ts': 'export default function main() {}',
      'src/destructured.ts': 'export const { a } = obj',
    })
    expect(result.findings).toEqual([])
    expect(result.notices).toEqual([
      'TypeScript: filename check skipped 3 file(s) whose exports cannot be enumerated (re-export, default export, destructured export): src/barrel.ts, src/destructured.ts, src/dflt.ts',
    ])
  })

  test('`export import a = b.c` is opaque: no finding, notice with the re-export reason', () => {
    const result = checkFixture({ ...PKG, 'src/loader.ts': 'export function foo() {}\nexport import a = b.c' })
    expect(result.findings).toEqual([])
    expect(result.notices).toEqual([
      'TypeScript: filename check skipped 1 file(s) whose exports cannot be enumerated (re-export): src/loader.ts',
    ])
  })

  test('a Dart export directive yields a notice', () => {
    const result = checkFixture({ ...PUBSPEC, 'lib/barrel.dart': 'export \'src/a.dart\';\nclass Widget {}' })
    expect(result.notices).toEqual(['Dart: filename check skipped 1 file(s) whose exports cannot be enumerated (re-export): lib/barrel.dart'])
  })

  test('files exempt by convention, or judged anyway, yield no notice', () => {
    const result = checkFixture({
      ...PKG,
      'src/index.ts': 'export * from \'./a\'',
      'src/errors.ts': 'export { x as default }',
      'src/util.ts': 'export function a() {}\nexport function b() {}\nexport * from \'./c\'',
      'src/a.test.ts': 'export default 1',
    })
    expect(result.notices).toEqual([])
  })

  test('lists at most 3 example paths in sorted order, then an ellipsis', () => {
    const files = Object.fromEntries(['e', 'a', 'd', 'b', 'c'].map(n => [`src/${n}.ts`, 'export * from \'./x\'']))
    const result = checkFixture({ ...PKG, ...files })
    expect(result.findings).toEqual([])
    expect(result.notices).toEqual([
      'TypeScript: filename check skipped 5 file(s) whose exports cannot be enumerated (re-export): src/a.ts, src/b.ts, src/c.ts, …',
    ])
  })
})
