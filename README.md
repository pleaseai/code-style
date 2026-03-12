# @pleaseai/code-style

A monorepo providing shared code style configurations for PleaseAI projects — for outsourcing, open source, and internal use.

## Packages

| Package | Description |
|---------|-------------|
| [`@pleaseai/eslint-config`](./packages/eslint-config) | ESLint flat config wrapping `@antfu/eslint-config` with PleaseAI defaults |
| [`@pleaseai/editorconfig`](./packages/editorconfig) | Shared `.editorconfig` for consistent editor settings |

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

## Development

```sh
bun install
bun run build   # Build all packages via Turborepo
bun run lint    # Lint the repo itself (dogfooding)
```

### Releasing

```sh
bun run changeset   # Create a changeset
bun run version     # Bump versions
bun run release     # Build + publish to npm
```
