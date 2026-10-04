# @pleaseai/code-organization

English | [한국어](./README.ko.md)

Rules that keep a codebase navigable for coding agents: public symbols you can
find by name, files named after what they export, and tests at a path you can
derive from the source. This package is the enforcement side of
[ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md)
for TypeScript, Dart, Kotlin, Java, and Rust.

Every rule ships as a **warning**. Nothing here fails a build unless you opt in
with `--strict` or by raising a rule's severity in your own config.

## Install

```sh
bun add -D @pleaseai/code-organization
```

`bunx @pleaseai/code-style init` does this for you and writes `sgconfig.yml`
(select **code-organization**). The package depends on
[`@ast-grep/cli`](https://ast-grep.github.io/), which provides the
`ast-grep` binary.

With bun, add `"trustedDependencies": ["@ast-grep/cli"]` to your
`package.json` so its postinstall step runs; otherwise `ast-grep` prints a
fallback warning on every call (the path checker is unaffected).

## The five principles

| Slug | Principle |
| --- | --- |
| `code-greppable-public-symbols` | Public symbols are named declarations, so one name search finds the definition and every use. |
| `code-filename-matches-primary-symbol` | A file with one public symbol is named after it (normalized to the language's file-name convention). |
| `code-error-types-in-dedicated-module` | A module's error types live in its designated error file or package. |
| `test-path-derivable-from-source` | Tests live under the toolchain's test root, at a path mirrored from the source they test. |
| `test-helpers-in-dedicated-location` | Helpers shared by several tests live in the designated helper location. |

The checks run in two layers. Layer 2 is a set of ast-grep rules; layer 3 is a
path checker for what ast-grep cannot see (file names, test paths, and which
helpers are shared).

## Layer 2: ast-grep rules

Point your project's `sgconfig.yml` at the rules:

```yaml
# sgconfig.yml
ruleDirs:
  - node_modules/@pleaseai/code-organization/rules
```

```sh
bunx ast-grep scan
```

Or use the package's own config without adding one:

```sh
bunx ast-grep scan -c node_modules/@pleaseai/code-organization/sgconfig.yml
```

| Rule | Slug | Language |
| --- | --- | --- |
| [`ts-no-default-export`](./rules/typescript/ts-no-default-export.md) | `code-greppable-public-symbols` | TypeScript |
| [`tsx-no-default-export`](./rules/tsx/tsx-no-default-export.md) | `code-greppable-public-symbols` | TSX |
| [`rust-no-glob-reexport`](./rules/rust/rust-no-glob-reexport.md) | `code-greppable-public-symbols` | Rust |
| [`ts-error-outside-errors-file`](./rules/typescript/ts-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | TypeScript |
| [`tsx-error-outside-errors-file`](./rules/tsx/tsx-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | TSX |
| [`dart-error-outside-errors-file`](./rules/dart/dart-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | Dart |
| [`kotlin-error-outside-errors-file`](./rules/kotlin/kotlin-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | Kotlin |
| [`java-error-outside-error-package`](./rules/java/java-error-outside-error-package.md) | `code-error-types-in-dedicated-module` | Java |
| [`rust-error-outside-error-file`](./rules/rust/rust-error-outside-error-file.md) | `code-error-types-in-dedicated-module` | Rust |
| [`ts-no-in-source-test`](./rules/typescript/ts-no-in-source-test.md) | `test-path-derivable-from-source` | TypeScript |
| [`tsx-no-in-source-test`](./rules/tsx/tsx-no-in-source-test.md) | `test-path-derivable-from-source` | TSX |

Each rule has a README next to it with the reason, a wrong and a right
example, and the steps to fix a violation. The warning message names the slug
and the README path, so an agent can fix the violation from the message alone.

Files whose shape a framework dictates (config files, Nuxt `pages/` and
`layouts/`, Nitro `server/api/`, Storybook stories, and so on) are excluded
through each rule's `ignores` list.

## Layer 3: path checker

```sh
bunx please-code-org check            # check the current directory
bunx please-code-org check packages/  # check a subdirectory
bunx please-code-org check --json     # machine-readable output
bunx please-code-org check --strict   # exit 1 on any finding
```

| Exit code | Meaning |
| --- | --- |
| `0` | No findings, or warnings only (the default) |
| `1` | Findings, with `--strict` |
| `2` | Usage or config error |

What it checks:

- **`code-filename-matches-primary-symbol`** (TypeScript, Dart): a file with
  exactly one public symbol is named after it, compared in kebab-case
  (TypeScript) or snake_case (Dart). `errors.ts`/`errors.dart`, `index.ts`,
  config files, test files, `part of` files, and generated Dart files are
  exempt. Kotlin and Java are covered by ktlint `standard:filename` and javac.
- **`test-path-derivable-from-source`**:
  - TypeScript: `src/foo/bar.ts` ↔ `test/foo/bar.test.ts` (or `tests/`,
    `.spec.ts`). With one source root the root name is dropped; with several
    (Nuxt 4: `app/`, `server/`, `shared/`) it is kept:
    `server/utils/db.ts` ↔ `test/unit/server/utils/db.test.ts`.
  - Dart: `lib/a/b.dart` ↔ `test/a/b_test.dart`.
  - Kotlin/Java: `src/main/kotlin/…/Foo.kt` ↔ `src/test/kotlin/…/FooTest.kt`
    (same for `java`).
  - An environment segment directly under the test root is allowed if it is on
    the closed list `unit`, `nuxt`, `browser`, `e2e`. A first segment on the
    list is tried both as an environment and as part of the mirrored path.
    Tests under `e2e/` are never derived.
  - Reported: tests with no matching source (orphans) and test files outside
    the test root. Sources without tests are never reported.
  - Rust: integration tests must be where Cargo finds them. The checker reads
    `cargo metadata --no-deps --format-version 1` and follows `mod`
    declarations, then reports `tests/**/*.rs` files Cargo never compiles
    (except `tests/common/` and submodules of a `tests/<name>/main.rs`
    target), and `#[test]` files no `mod` declaration reaches. Without
    `cargo`, Rust is skipped with a notice.
- **`test-helpers-in-dedicated-location`**: a helper candidate (`mock*`,
  `createMock*`, `fake*`, `stub*`) declared outside the designated location is
  reported only when two or more test files import it. Designated locations:
  `<test-root>/test-utils/` (TypeScript), `test/helpers/` (Dart),
  `src/testFixtures/` (Kotlin/Java Gradle test fixtures), `tests/common/`
  (Rust; a non-`common` module pulled in by two or more test targets is
  reported).

### Config

An optional `code-organization.json` in the checked directory (or in any
package directory, which adds to it) can only **add** names. There is no
option to move tests next to sources or to turn a check off.

```json
{
  "sourceRoots": ["lib"],
  "envSegments": ["integration"]
}
```

| Key | Effect |
| --- | --- |
| `sourceRoots` | Extra TypeScript source roots, for example a Nuxt project with a custom `srcDir`. Adding a root makes the package multi-root, so root names stay in test paths. |
| `envSegments` | Extra environment segment names allowed directly under a test root. |

Use `--config <file>` to read a config from somewhere else.

### Programmatic use

```ts
import { checkCodeOrganization } from '@pleaseai/code-organization'

const { findings, notices } = checkCodeOrganization({ root: process.cwd() })
```

`cargoMetadata` in the options replaces the `cargo metadata` call, for
environments without cargo.

## Moving tests

When you move tests to satisfy `test-path-derivable-from-source`, compare the
runner's test list before and after (`vitest list`, `cargo test -- --list`). A
runner that finds no tests still exits with success, so the exit code alone
does not catch lost tests.

## License

MIT
