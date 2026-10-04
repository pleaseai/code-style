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
from `@ast-grep/cli`, and resolves both from the checked project first (falling
back to the CLI's own install). They are optional peer dependencies of this
package, so install them in the project — the **ast-grep** tool in `init` does
this:

```bash
bun add -D @pleaseai/ast-grep-config @ast-grep/cli
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
| `2` | Usage or config error, or `@pleaseai/ast-grep-config` / `@ast-grep/cli` cannot be resolved |

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
