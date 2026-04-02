# @pleaseai/eslint-config

[![npm](https://img.shields.io/npm/v/@pleaseai/eslint-config?color=444&label=)](https://npmjs.com/package/@pleaseai/eslint-config)

PleaseAI's shared ESLint config, built on top of [@antfu/eslint-config](https://github.com/antfu/eslint-config).

- Based on `@antfu/eslint-config` with PleaseAI defaults
- Auto fix for formatting (aimed to be used standalone **without** Prettier)
- [ESLint Flat config](https://eslint.org/docs/latest/use/configure/configuration-files-new), compose easily!
- TypeScript, JSX, Vue, JSON, YAML, Markdown, etc. Out-of-box
- Optional [React](#react), [Next.js](#nextjs), [Svelte](#svelte), [UnoCSS](#unocss), [Astro](#astro), [Solid](#solid), [Angular](#angular) support
- Optional [formatters](#formatters) support for CSS, HTML, XML, etc.
- Includes [`eslint-plugin-package-json`](#package-json-linting) configs
- Requires ESLint v9.10.0+

## PleaseAI Defaults

This config wraps `@antfu/eslint-config` with the following defaults:

| Option | Value |
|--------|-------|
| Indent | 2 spaces |
| Quotes | Single |
| Semicolons | No |
| TypeScript | Enabled |
| Gitignore | Enabled |

Additionally, `test/prefer-lowercase-title` is disabled.

## Usage

### Install

```bash
bun add -D @pleaseai/eslint-config eslint
```

### Configure

Create `eslint.config.ts` (or `eslint.config.mjs`) in your project root:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
```

### Add scripts to `package.json`

```json
{
  "scripts": {
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  }
}
```

## Customization

The `pleaseai()` function accepts the same options as `antfu()`. All `@antfu/eslint-config` options are supported.

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  // Override PleaseAI defaults
  stylistic: {
    indent: 4,
  },

  // Enable framework support
  vue: true,
  react: true,

  // Add ignores
  ignores: [
    '**/fixtures',
  ],
})
```

You can also pass additional flat configs as extra arguments:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai(
  {
    // PleaseAI + antfu options
    typescript: true,
  },
  // Additional ESLint flat configs
  {
    files: ['**/*.ts'],
    rules: {
      'ts/consistent-type-definitions': ['error', 'interface'],
    },
  },
)
```

### Rules Overrides

Use the `overrides` option in each integration:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  vue: {
    overrides: {
      'vue/operator-linebreak': ['error', 'before'],
    },
  },
  typescript: {
    overrides: {
      'ts/consistent-type-definitions': ['error', 'interface'],
    },
  },
})
```

### Type Aware Rules

Enable [type aware rules](https://typescript-eslint.io/linting/typed-linting/) by passing `tsconfigPath`:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  typescript: {
    tsconfigPath: 'tsconfig.json',
  },
})
```

## Optional Configs

### React

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  react: true,
})
```

```bash
bun add -D @eslint-react/eslint-plugin eslint-plugin-react-refresh
```

### Next.js

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  nextjs: true,
})
```

```bash
bun add -D @next/eslint-plugin-next
```

### Vue

Vue support is auto-detected. You can also explicitly enable it:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  vue: true,
})
```

### Svelte

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  svelte: true,
})
```

```bash
bun add -D eslint-plugin-svelte
```

### Astro

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  astro: true,
})
```

```bash
bun add -D eslint-plugin-astro
```

### Solid

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  solid: true,
})
```

```bash
bun add -D eslint-plugin-solid
```

### UnoCSS

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  unocss: true,
})
```

```bash
bun add -D @unocss/eslint-plugin
```

### Angular

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  angular: true,
})
```

```bash
bun add -D @angular-eslint/eslint-plugin @angular-eslint/eslint-plugin-template @angular-eslint/template-parser
```

### Formatters

Use external formatters for files that ESLint cannot handle yet (`.css`, `.html`, etc):

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  formatters: {
    css: true,
    html: true,
    markdown: 'prettier',
  },
})
```

```bash
bun add -D eslint-plugin-format
```

## Package JSON Linting

This package also exports `eslint-plugin-package-json` configs:

```js
import { recommended, stylistic } from '@pleaseai/eslint-config/package-json'
```

- `recommended` — `eslint-plugin-package-json` recommended-publishable config
- `stylistic` — `eslint-plugin-package-json` stylistic config

## IDE Support (auto fix on save)

### VS Code

Install [VS Code ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and add the following to `.vscode/settings.json`:

```jsonc
{
  // Disable the default formatter, use eslint instead
  "prettier.enable": false,
  "editor.formatOnSave": false,

  // Auto fix
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },

  // Silent the stylistic rules in your IDE, but still auto fix them
  "eslint.rules.customizations": [
    { "rule": "style/*", "severity": "off", "fixable": true },
    { "rule": "format/*", "severity": "off", "fixable": true },
    { "rule": "*-indent", "severity": "off", "fixable": true },
    { "rule": "*-spacing", "severity": "off", "fixable": true },
    { "rule": "*-spaces", "severity": "off", "fixable": true },
    { "rule": "*-order", "severity": "off", "fixable": true },
    { "rule": "*-dangle", "severity": "off", "fixable": true },
    { "rule": "*-newline", "severity": "off", "fixable": true },
    { "rule": "*quotes", "severity": "off", "fixable": true },
    { "rule": "*semi", "severity": "off", "fixable": true }
  ],

  // Enable eslint for all supported languages
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "vue",
    "html",
    "markdown",
    "json",
    "jsonc",
    "yaml",
    "toml",
    "xml",
    "gql",
    "graphql",
    "astro",
    "svelte",
    "css",
    "less",
    "scss",
    "pcss",
    "postcss"
  ]
}
```

### Lint Staged

```json
{
  "simple-git-hooks": {
    "pre-commit": "bun lint-staged"
  },
  "lint-staged": {
    "*": "eslint --fix"
  }
}
```

```bash
bun add -D lint-staged simple-git-hooks
npx simple-git-hooks
```

## View Enabled Rules

Use [@eslint/config-inspector](https://github.com/eslint/config-inspector) to visualize what rules are enabled:

```bash
npx @eslint/config-inspector
```

## Plugins Renaming

This config inherits `@antfu/eslint-config`'s plugin renaming for a consistent DX:

| New Prefix | Original Prefix | Source Plugin |
|------------|-----------------|---------------|
| `import/*` | `import-lite/*` | [eslint-plugin-import-lite](https://github.com/9romise/eslint-plugin-import-lite) |
| `node/*` | `n/*` | [eslint-plugin-n](https://github.com/eslint-community/eslint-plugin-n) |
| `yaml/*` | `yml/*` | [eslint-plugin-yml](https://github.com/ota-meshi/eslint-plugin-yml) |
| `ts/*` | `@typescript-eslint/*` | [@typescript-eslint/eslint-plugin](https://github.com/typescript-eslint/typescript-eslint) |
| `style/*` | `@stylistic/*` | [@stylistic/eslint-plugin](https://github.com/eslint-stylistic/eslint-stylistic) |
| `test/*` | `vitest/*` | [@vitest/eslint-plugin](https://github.com/vitest-dev/eslint-plugin-vitest) |

## Re-exports

All exports from `@antfu/eslint-config` are re-exported, so you can import fine-grained configs directly:

```js
import { combine, javascript, typescript, vue } from '@pleaseai/eslint-config'
```

## License

[MIT](./LICENSE)
