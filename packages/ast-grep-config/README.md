# @pleaseai/ast-grep-config

English | [한국어](./README.ko.md)

[ast-grep](https://ast-grep.github.io/) rules that keep a codebase navigable
for coding agents: public symbols you can find by name, error types in a
designated file, and no tests inside source files. This package is the layer-2
(structural) side of
[ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md)
for TypeScript, Dart, Kotlin, Java, and Rust. The layer-3 path checker (file
names, test paths, shared test helpers) is
[`please-style check`](../cli/README.md#please-style-check) in
`@pleaseai/code-style`, which uses this package's `extract/` rules.

Every rule ships as a **warning**. Nothing here fails a build unless you raise
a rule's severity in your own config.

## Install

```sh
bun add -D @pleaseai/ast-grep-config @ast-grep/cli
```

`bunx @pleaseai/code-style init` does this for you and writes `sgconfig.yml`
(select **ast-grep**). [`@ast-grep/cli`](https://ast-grep.github.io/) is a peer
dependency that provides the `ast-grep` binary; install it next to this
package so `ast-grep` is on your project's bin path.

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

The checks run in two layers. Layer 2 is the ast-grep rules in this package;
layer 3 is `please-style check`, a path checker for what ast-grep cannot see
(file names, test paths, and which helpers are shared).

## Rules

Point your project's `sgconfig.yml` at the rules:

```yaml
# sgconfig.yml
ruleDirs:
  - node_modules/@pleaseai/ast-grep-config/rules
```

```sh
bunx ast-grep scan
```

Or use the package's own config without adding one:

```sh
bunx ast-grep scan -c node_modules/@pleaseai/ast-grep-config/sgconfig.yml
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

Files whose shape a framework dictates (config files, Nuxt 4 `app/pages/` and
`app/layouts/`, Nitro `server/api/`, Storybook stories, and so on) are excluded
through each rule's `ignores` list. Nuxt 3 root layouts (`pages/` without
`app/`) are not; the
[`ts-no-default-export` README](./rules/typescript/ts-no-default-export.md#nuxt-3-layouts-no-app-directory)
shows how to scope the rule for them.

`extract/` holds the extraction rules `please-style check` runs. It is not in
`ruleDirs`, so its matches never appear in `ast-grep scan` output.

## License

MIT
