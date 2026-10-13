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

## `@pleaseai/eslint-config`

### Installation

```sh
bun add -D @pleaseai/eslint-config eslint
```

### Usage

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

### Defaults

- `stylistic`: `indent: 2`, `quotes: 'single'`, `semi: false`
- `typescript: true`
- `gitignore: true`

## `@pleaseai/ast-grep-config`

### Installation

```sh
bun add -D @pleaseai/ast-grep-config @ast-grep/cli
```

### Usage

```yaml
# sgconfig.yml
ruleDirs:
  - node_modules/@pleaseai/ast-grep-config/rules
```

```sh
bunx ast-grep scan
```

Every rule ships as a warning. See the [ast-grep Config guide](https://code-style.pages.dev/en/ast-grep-config) for the rule list and how to fix each violation.

## Development

To set up the repo, build, and lint locally, follow [Getting started in CONTRIBUTING.md](./CONTRIBUTING.md#getting-started).

### Releasing

[release-please](https://github.com/googleapis/release-please) automates releases from Conventional Commits, and GitHub Actions publishes the packages to npm with provenance.
