# @pleaseai/code-style

English | [한국어](./README.ko.md)

A monorepo providing shared code style configurations for PleaseAI projects — for outsourcing, open source, and internal use.

See the [code-style documentation site](https://code-style.pages.dev) for full guides.

## Packages

| Package | Description |
|---------|-------------|
| [`@pleaseai/eslint-config`](./packages/eslint-config) | ESLint flat config wrapping `@antfu/eslint-config` with PleaseAI defaults |
| [`@pleaseai/prettier-config`](./packages/perttier-config) | Shared Prettier config (JSON) |
| [`@pleaseai/editorconfig`](./packages/editorconfig) | Shared `.editorconfig` for consistent editor settings |
| [`@pleaseai/ast-grep-config`](./packages/ast-grep-config) | ast-grep rules for agent-navigable code (ADR-0022); the path checker is `please-style check` |
| [`@pleaseai/bun-lint-config`](./packages/bun-lint-config) | `bunfig.toml` `[lint]` tables with the `@pleaseai/eslint-config` rules that `bun lint` runs natively |

## `@pleaseai/eslint-config`

### eslint-config installation

```sh
bun add -D @pleaseai/eslint-config eslint
```

### eslint-config usage

```ts
// eslint.config.ts
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
```

With custom overrides:

```ts
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai(
  {
    // Override defaults (typescript, stylistic, gitignore are pre-configured)
    vue: true,
  },
  // Additional flat config entries
  {
    rules: {
      'no-console': 'warn',
    },
  },
)
```

### eslint-config defaults

- `stylistic`: `indent: 2`, `quotes: 'single'`, `semi: false`
- `typescript: true`
- `gitignore: true`

## `@pleaseai/ast-grep-config`

### ast-grep-config installation

```sh
bun add -D @pleaseai/ast-grep-config @ast-grep/cli
```

### ast-grep-config usage

```yaml
# sgconfig.yml
ruleDirs:
  - node_modules/@pleaseai/ast-grep-config/rules
```

```sh
bunx ast-grep scan
```

Every rule ships as a warning. See the [ast-grep Config guide](https://code-style.pages.dev/en/ast-grep-config) for the rule list and how to fix each violation.

## `@pleaseai/bun-lint-config`

```sh
bunx @pleaseai/code-style init   # select bun-lint-config
```

`init` writes the package's `lint.toml` into `bunfig.toml` for `bun lint` (Bun canary). See the [bun lint Config guide](https://code-style.pages.dev/en/bun-lint-config) for what it covers and how to copy it by hand.

## Development

To set up the repo, build, and lint locally, follow [Getting started in CONTRIBUTING.md](./CONTRIBUTING.md#getting-started).

### Releasing

[release-please](https://github.com/googleapis/release-please) automates releases from Conventional Commits, and GitHub Actions publishes the packages to npm with provenance.
