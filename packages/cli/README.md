# @pleaseai/code-style

English | [한국어](./README.ko.md)

CLI that wires PleaseAI's shared code style into any project — installs the
eslint/prettier/editorconfig/ast-grep packages and manages the `AGENTS.md`
rules block so AI coding assistants know how to write code that passes lint on
the first try. `please-style check` checks file names and test paths.

Inspired by [ultracite](https://github.com/haydenbleasel/ultracite) and
NaverPay's [`@naverpay/code-style-cli`](https://github.com/NaverPayDev/code-style).

## Usage

From the root of any project that has a `package.json`:

```bash
bunx @pleaseai/code-style         # same as `init`
bunx @pleaseai/code-style init    # interactive setup
bunx @pleaseai/code-style update  # re-apply the AGENTS.md rules block only
bunx @pleaseai/code-style doctor  # check current project status
bunx @pleaseai/code-style check   # check file names and test paths (ADR-0022)
```

Also works with `npx`, `pnpm dlx`, and `yarn dlx`.

## What it does

The `init` command:

1. Detects your package manager (bun → pnpm → yarn → npm, based on lockfile).
2. Shows a checkbox UI listing PleaseAI code-style tools; already-installed
   ones are labelled `(installed)` / `(설치됨)`.
3. Installs the packages you selected as dev dependencies.
4. Writes / updates the corresponding config files.

### Supported tools

| Tool | npm package(s) | Config file |
| --- | --- | --- |
| eslint-config | `@pleaseai/eslint-config`, `eslint` | `eslint.config.mjs` |
| prettier-config | `@pleaseai/prettier-config`, `prettier` | `package.json#prettier` |
| editorconfig | `@pleaseai/editorconfig` | `.editorconfig` (copied from `node_modules`) |
| agents-md | — | `AGENTS.md` (marker-managed block) |
| ast-grep | `@pleaseai/ast-grep-config`, `@ast-grep/cli` | `sgconfig.yml` |

## ast-grep rules

Selecting **ast-grep** installs
[`@pleaseai/ast-grep-config`](../ast-grep-config) and `@ast-grep/cli`, and
writes an `sgconfig.yml` that points ast-grep at the rules. Two commands check
a project; both only warn by default:

```bash
bunx ast-grep scan                    # default exports, error-file placement, in-source tests, …
bunx @pleaseai/code-style check       # file names, test paths, shared test helpers
bunx @pleaseai/code-style check --strict   # exit 1 on any finding (for CI once clean)
```

Every warning names the rule's slug and links to a README with the fix. See
the [`@pleaseai/ast-grep-config` README](../ast-grep-config/README.md) for
the structural rules.

## `please-style check`

`check` is the layer-3 path checker of
[ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md):
it covers what ast-grep cannot see (file names, test paths, and which helpers
are shared). It runs the extraction rules shipped in
[`@pleaseai/ast-grep-config`](../ast-grep-config) with the `ast-grep` binary
from `@ast-grep/cli`. The extraction rules are an internal detail of `check`
and must match this CLI's code, so they come from the CLI's own
`@pleaseai/ast-grep-config` dependency; the checked project's copy is used only
when the CLI's own cannot be resolved (it exists to provide the lint `rules/`
that `sgconfig.yml` points at).
The binary resolves from the checked project first, so the project's pinned
ast-grep version wins, then falls back to the CLI's own install. `@ast-grep/cli`
is an optional peer dependency of this package, so install it in the project —
the **ast-grep** tool in `init` does this:

```bash
bun add -D @ast-grep/cli
```

```bash
bunx @pleaseai/code-style check            # check the current directory
bunx @pleaseai/code-style check packages/  # check a subdirectory
bunx @pleaseai/code-style check --json     # machine-readable output
bunx @pleaseai/code-style check --strict   # exit 1 on any finding
```

| Flag | Description |
| --- | --- |
| `[path]` | Directory to check (default: the current directory) |
| `--json` | Print the result as JSON (`root`, `findings`, `notices`) |
| `--strict` | Exit 1 when there is any finding (default: warn only) |
| `--config <file>` | Config file (default: `<path>/code-organization.json`) |
| `--help`, `-h` | Print the `check` usage |

| Exit code | Meaning |
| --- | --- |
| `0` | No findings, or warnings only (the default) |
| `1` | Findings, with `--strict` |
| `2` | Usage or config error, or `@ast-grep/cli` cannot be resolved |

What it checks:

- **`code-filename-matches-primary-symbol`** (TypeScript, Dart): a file with
  exactly one public symbol is named after it, compared in kebab-case
  (TypeScript) or snake_case (Dart). `errors.ts`/`errors.dart`, `index.ts`,
  config files, test files, `part of` files, generated Dart files, framework
  route files (`route.ts`, `middleware.ts`, SvelteKit `+*.ts`), and Dart
  entrypoints under `bin/`, `tool/`, `example/` and `web/` are exempt. Kotlin and Java are covered by ktlint `standard:filename` and javac.
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

### Supported syntax

`check` reads declarations with ast-grep extraction rules, not a full compiler.
Where the extraction cannot enumerate something, it withholds judgement instead
of guessing, and says so with a `notice:` line (text output) or an entry in
`notices` (`--json`, also echoed to stderr). Notices never change `findings`
or the exit code; only findings do, with `--strict`.

#### `code-filename-matches-primary-symbol`

Checked files: TypeScript `.ts`/`.mts`/`.cts`/`.tsx` and Dart `.dart` (plain
`.js` and `.vue` files are not read). Only **top-level** declarations count.

| Language | Counts as a public symbol |
| --- | --- |
| TypeScript, TSX | `export` of a `function`, generator function, `class`, `abstract class`, `interface`, `type`, `enum`, function overload signature, `namespace`/`module` (the namespace, not its members), `const`/`let`/`var` binding; the same with `export declare`; `export { local }` and `export { local as name }` without a `from` clause |
| Dart | Non-underscore `class`, `mixin`, `enum`, named `extension`, function, getter, setter, `typedef`, and top-level variable (`var`, `final`, `const`) |

A file is judged only when it has exactly one such symbol. Several symbols, or
none, are not checked.

Files skipped **with a notice** (the check would otherwise judge them, but
their exports cannot be enumerated):

| Language | Skipped form | Reason in the notice |
| --- | --- | --- |
| TypeScript, TSX | `export { a } from '…'`, `export * from '…'`, `export * as ns from '…'`, `export import a = b.c` | `re-export` |
| TypeScript, TSX | `export default …`, `export { x as default }`, `export { default }` | `default export` |
| TypeScript, TSX | `export const { a } = obj`, `export const [a] = arr` | `destructured export` |
| TypeScript, TSX | `export { x as "string name" }` | `string-literal export name` |
| Dart | `export 'other.dart';` | `re-export` |

The notice is aggregated per language, with the count and up to three sorted
example paths:

```text
notice: TypeScript: filename check skipped 4 file(s) whose exports cannot be enumerated (re-export, default export): src/a.ts, src/b.ts, src/c.ts, …
```

A file with two or more enumerated symbols is never judged, so it gets no
notice even if it also re-exports.

`export = x` is not extracted and gets no notice: TypeScript forbids an export
assignment in a module with other exported elements (TS2309), so it cannot
leave a file judged on a partial symbol list. A file with only `export = x` has
no extracted name and is not judged.

Exempt **by convention** (no finding, no notice):

- TypeScript: `*.d.ts`, `*.test.*`/`*.spec.*`, `index.*`, `errors.*`,
  `route.*`, `middleware.*`, `+*` files, `*.config.*`, and anything under the
  package's test root (`test/`, `tests/`).
- Dart: `part of` files, files under `integration_test/`, `test_driver/`,
  `bin/`, `tool/`, `example/`, `web/` or the test root, `*_test.dart`,
  `errors.dart`, and generated files whose name has an extra dot (`*.g.dart`,
  `*.freezed.dart`).

Names are compared by a separator-free key: the name is split into words at
case changes and non-alphanumeric characters, lowercased and joined without a
separator. `GraphQLClient`, `graphql-client` and `graphql_client` all give
`graphqlclient`, so acronyms match whether or not the file splits them. The
suggested name in a finding is the symbol in kebab-case (TypeScript) or
snake_case (Dart), for example `parseURL` → `parse-url.ts`.

#### `test-path-derivable-from-source`

- TypeScript test files are `*.test.*`/`*.spec.*` with a `.ts`, `.tsx`, `.mts`,
  `.cts`, `.js`, `.jsx`, `.mjs` or `.cjs` extension. The source may be any of
  those plus `.vue`, or `<stem>/index.<ext>`. Packages are directories with a
  `package.json`; Nuxt projects (a `nuxt.config.*` next to it) use `app/`,
  `server/` and `shared/` as source roots.
- Dart packages are directories with a `pubspec.yaml`; tests are `*_test.dart`
  and sources live in `lib/`. `integration_test/` and `test_driver/` are not
  reported as outside the test root.
- Kotlin and Java modules are directories that contain `src/main|test|testFixtures/<lang>/`;
  tests are `*Test.kt`/`*Test.java`.
- Test files that belong to no package or module (no enclosing `package.json`,
  `pubspec.yaml` or `src/<set>/<lang>/` directory) are not checked. This is
  reported as a notice, aggregated per language with the count and up to three
  sorted example paths:

  ```text
  notice: TypeScript: test-path check skipped 2 test file(s) outside any package (no package.json above them): a.test.ts, b.test.ts
  ```

Rust module resolution (to find test files Cargo never compiles):

| Form | Handling |
| --- | --- |
| `mod x;` | Loads `x.rs` or `x/mod.rs` next to the declaring file; from a plain `foo.rs` the base directory is `foo/`, from a crate root or `mod.rs` it is the file's directory |
| `#[path = "…"] mod x;` | Resolved relative to the declaring file's directory; plain, `r"…"` and `r#"…"#` strings |
| `#[cfg_attr(…, path = "…")] mod x;` | Both the `path` file and the default `x.rs`/`x/mod.rs` count as possible targets |
| `mod r#async;` | Loads `async.rs` |
| `mod x;` inside an inline `mod { … }` or a function body | Not followed. Reachability checks are **skipped for the directory it could load from, with a notice** |
| The same, carrying `#[path]` or `#[cfg_attr(…, path = …)]` | It can load a file anywhere in the crate, so reachability checks are **skipped for the whole crate, with a notice** |
| A crate whose `cargo metadata` fails | **Skipped with a notice**; its directory is still a boundary for the parent crate |
| `cargo` missing | Rust **skipped with a notice** |
| A file under `tests/<subdir>/` that no target reaches, where `<subdir>` is `ui`, `compile-fail`, `compile-pass` or `fixtures`, or a path segment of a string literal in a `tests/*.rs` target (trybuild/compiletest inputs such as `t.compile_fail("tests/ui/*.rs")`) | A test target may load it at runtime, so `undiscovered-integration-test` is **withheld with an aggregated notice** (count and up to three sorted example paths) |

#### `test-helpers-in-dedicated-location`

A helper candidate is a top-level declaration named `mock*`, `createMock*`,
`fake*` or `stub*` (the next character must start a new word): in TypeScript a
function, generator, class or `const`/`let`/`var`; in Dart any top-level name
from the table above; in Kotlin a class, object or function; in Java a class,
interface, record or enum. It is reported only when declared on the test side
and imported by two or more other test files. How imports are
resolved:

| Language | Import forms followed |
| --- | --- |
| TypeScript, TSX | Relative specifiers (`./`, `../`) in test files: `import { x }`, `import * as ns` (counts as importing every export). Resolution tries the path as written, then `.js` → `.ts`/`.tsx`, `.jsx` → `.tsx`, `.mjs` → `.mts`, `.cjs` → `.cts`, then the source extensions, then `<path>/index.<ext>`. A helper exported as `export { local as alias }` is matched under both names |
| Dart | Relative `import 'x.dart';` (with or without `./`). `show` limits the imported names, `hide` removes them; no combinator imports everything |
| Kotlin, Java | `import pkg.Name`, `import pkg.Name.member`, `import pkg.*`, `import static …` (an `as` alias is ignored), and same-package test files that mention the name as a word. Only test files of the module that owns the helper count, because other modules can declare the same fully qualified name |

#### Not supported

These are confirmed gaps in the extraction. None of them is reported by a
notice, and each can hide a finding:

- TypeScript import resolution: non-relative specifiers are ignored, so
  `tsconfig.json` `paths` aliases (`@/test-utils/x`), `package.json` `imports`
  (`#x`) and workspace package names do not link a test to a helper.
  `require()`, dynamic `import()` and re-exports through a barrel
  (`export * from`) are not followed, and a relative import that resolves to no
  listed file (for example a generated file) is ignored.
- Dart: `package:` and `dart:` imports (including your own `package:app/…`) are
  not followed, and neither are exports through a barrel file or conditional
  imports.
- TypeScript exports: CommonJS (`module.exports`) is not recognized as symbols;
  JavaScript files are not read at all. Dart declarations not listed in the
  table above (for example `extension type`) are not counted either.
- Rust: only literal `mod` items are read. Modules generated by macros, `include!`
  and `#[path]` on an inline `mod x { … }` are not seen.
- Kotlin and Java file names are not checked here (ktlint `standard:filename`
  and javac cover them).
- Kotlin under `src/<set>/java`: Gradle allows Kotlin sources there, but
  source-set and test-path mapping treats only `src/<set>/kotlin` as Kotlin
  (and only `src/<set>/java` as Java, for `.java` files). Kotlin files under
  `src/<set>/java` are not mapped, so they get no test-path or helper findings.
- `--config <file>` replaces the root `code-organization.json` instead of
  merging with it: when it is given, the root file is not read at all. A
  package's own `code-organization.json` is still merged on top of it.

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

### Moving tests

When you move tests to satisfy `test-path-derivable-from-source`, compare the
runner's test list before and after (`vitest list`, `cargo test -- --list`). A
runner that finds no tests still exits with success, so the exit code alone
does not catch lost tests.

## `AGENTS.md` block

The CLI owns only the content between these markers — everything else in
`AGENTS.md` is your content and is preserved verbatim:

```md
<!-- pleaseai-code-style:start -->
...managed content...
<!-- pleaseai-code-style:end -->
```

Re-run `pleaseai-code-style update` any time you upgrade `@pleaseai/code-style`
to refresh just this block. The full rules list is shipped as
`node_modules/@pleaseai/code-style/rules.md` for reference.

## Options

| Flag | Description |
| --- | --- |
| `--yes`, `-y` | Accept defaults, overwrite existing files without prompting |
| `--lang <ko\|en>` | Force the CLI locale (defaults to `$LANG`) |
| `--help`, `-h` | Print help |
| `--version`, `-v` | Print version |

## Localisation

The CLI auto-detects your locale from `LC_ALL` / `LANG` / `LC_MESSAGES` and
currently ships Korean and English messages. Override with `--lang ko` or
`--lang en`.

## License

MIT
