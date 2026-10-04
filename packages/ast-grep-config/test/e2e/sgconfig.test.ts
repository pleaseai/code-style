import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'bun:test'

// Rule tests (`ast-grep test`) cover the patterns; this covers what they
// cannot: the `files`/`ignores` globs and both ways a consumer wires the rules.
const PACKAGE = fileURLToPath(new URL('../../', import.meta.url))

// The native binary from the @ast-grep/cli devDependency, skipping the JS shim
// (bun blocks its postinstall by default, and the shim then warns per call).
const require = createRequire(import.meta.url)
const CLI_DIR = dirname(require.resolve('@ast-grep/cli/package.json'))
const { resolveBinaryPath } = require(join(CLI_DIR, 'postinstall.js')) as { resolveBinaryPath: () => string | null }
const AST_GREP = resolveBinaryPath() ?? join(CLI_DIR, 'ast-grep')

let cleanup = (): void => {}
afterEach(() => cleanup())

function createFixture(files: Record<string, string>): { root: string, cleanup: () => void } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ast-grep-config-test-')))
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const PROJECT = {
  'src/user-service.ts': 'export default class UserService {}',
  'src/payment.ts': 'export class PaymentDeclinedError extends Error {}',
  'src/errors.ts': 'export class NotFoundError extends Error {}',
  'src/sum.ts': 'export const sum = 1\nif (import.meta.vitest) { run() }',
  'test/sum.test.ts': 'class TestOnlyError extends Error {}',
  'vite.config.ts': 'export default defineConfig({})',
  'app/pages/index.ts': 'export default definePageMeta({})',
  'app/app.config.ts': 'export default defineAppConfig({})',
  'server/api/users.get.ts': 'export default defineEventHandler(() => [])',
  // Nuxt 3 root layout: not allowlisted (a bare `plugins/` glob would hide
  // every directory with that name).
  'pages/about.ts': 'export default {}',
  'packages/core/plugins/loader.ts': 'export default function load() {}',
  'src/button.stories.tsx': 'export default { title: "Button" }',
  'src/card.tsx': 'export default function Card() { return <div /> }',
  '.vitepress/config.mts': 'export default {}',
  'lib/auth/errors.dart': 'class AuthException implements Exception {}',
  'lib/auth/token_store.dart': 'class InvalidToken implements Exception {}',
  'src/main/kotlin/com/acme/Errors.kt': 'class A : RuntimeException()',
  'src/main/kotlin/com/acme/Billing.kt': 'class B : RuntimeException()',
  'src/main/java/com/acme/error/AException.java': 'public class AException extends RuntimeException {}',
  'src/main/java/com/acme/BException.java': 'public class BException extends RuntimeException {}',
  'crate/src/error.rs': 'pub enum Error { Io }',
  'crate/src/lib.rs': 'pub use crate::model::*;\npub struct ParseError;',
}

// Everything else in PROJECT is a designated or framework-dictated file.
const EXPECTED = [
  'crate/src/lib.rs:1 rust-no-glob-reexport',
  'crate/src/lib.rs:2 rust-error-outside-error-file',
  'lib/auth/token_store.dart:1 dart-error-outside-errors-file',
  'packages/core/plugins/loader.ts:1 ts-no-default-export',
  'pages/about.ts:1 ts-no-default-export',
  'src/card.tsx:1 tsx-no-default-export',
  'src/main/java/com/acme/BException.java:1 java-error-outside-error-package',
  'src/main/kotlin/com/acme/Billing.kt:1 kotlin-error-outside-errors-file',
  'src/payment.ts:1 ts-error-outside-errors-file',
  'src/sum.ts:2 ts-no-in-source-test',
  'src/user-service.ts:1 ts-no-default-export',
]

function scan(cwd: string, args: string[]): string[] {
  const res = spawnSync(AST_GREP, ['scan', ...args, '--json=stream', '.'], { cwd, encoding: 'utf-8' })
  expect(res.status).toBe(0)
  return res.stdout.trim().split('\n').filter(Boolean).map((line) => {
    const m = JSON.parse(line) as { file: string, ruleId: string, severity: string, range: { start: { line: number } } }
    expect(m.severity).toBe('warning')
    return `${m.file}:${m.range.start.line + 1} ${m.ruleId}`
  }).sort()
}

describe('consumer wiring of the layer-2 rules', () => {
  test('scanning with the package sgconfig.yml reports violations and honors the framework allowlist', () => {
    const fixture = createFixture(PROJECT)
    cleanup = fixture.cleanup
    expect(scan(fixture.root, ['-c', `${PACKAGE}sgconfig.yml`])).toEqual(EXPECTED)
  })

  test('a consumer sgconfig.yml whose ruleDirs point at the package rules gives the same result', () => {
    const fixture = createFixture(PROJECT)
    cleanup = fixture.cleanup
    // What the CLI writes, with node_modules/@pleaseai/ast-grep-config
    // replaced by the path from the fixture to this package.
    const rules = relative(fixture.root, `${PACKAGE}rules`)
    writeFileSync(join(fixture.root, 'sgconfig.yml'), `ruleDirs:\n  - ${rules}\n`)
    expect(scan(fixture.root, [])).toEqual(EXPECTED)
  })

  test('the documented Nuxt 3 workaround scopes the default-export rule without suppressions', () => {
    const fixture = createFixture(PROJECT)
    cleanup = fixture.cleanup
    const config = ['-c', `${PACKAGE}sgconfig.yml`]
    const rest = scan(fixture.root, [...config, '--off=ts-no-default-export'])
    const scoped = scan(fixture.root, [...config, '--filter', '^ts-no-default-export$', '--globs', '!pages/**'])
    expect([...rest, ...scoped].sort()).toEqual(EXPECTED.filter(e => e !== 'pages/about.ts:1 ts-no-default-export'))
  })
})
