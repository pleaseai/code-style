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
| `lessOpinionated` | `true` — disables `antfu/if-newline` and `antfu/curly`, enables `curly: ['error', 'all']` |
| `antfu/top-level-function` | Re-enabled — prefer `function` declarations at top level |

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

### Config Composer

The factory function `pleaseai()` returns a [`FlatConfigComposer` object from `eslint-flat-config-utils`](https://github.com/antfu/eslint-flat-config-utils#composer), so you can chain methods to compose the config even more flexibly:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
  .prepend(
    // some flat configs before the main config
  )
  // override any named config block
  .override(
    'antfu/stylistic/rules',
    {
      rules: {
        'style/generator-star-spacing': ['error', { after: true, before: false }],
      },
    },
  )
  // rename plugin prefixes
  .renamePlugins({
    'old-prefix': 'new-prefix',
    // ...
  })
  // remove a named config block entirely
  .remove('antfu/stylistic')
```

This is the composable escape-hatch when the plain `pleaseai({ ... })` options are not granular enough.

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

### Optional Rules — `command`

`@antfu/eslint-config` ships with [`eslint-plugin-command`](https://github.com/antfu/eslint-plugin-command), which `@pleaseai/eslint-config` inherits. It is **not** a typical lint rule — it's an on-demand micro-codemod that triggers on specific triple-slash comments.

A few built-in triggers:

- `/// to-function` — converts an arrow function to a `function` declaration
- `/// to-arrow` — converts a `function` declaration to an arrow function
- `/// to-for-each` — converts a `for`-loop to `.forEach()`
- `/// to-for-of` — converts a `.forEach()` to a `for-of`
- `/// keep-sorted` — sorts the next object/array/interface
- …see the [plugin docs](https://github.com/antfu/eslint-plugin-command#built-in-commands) for the full list

Place the trigger one line above the code you want to transform:

<!-- eslint-skip -->

```ts
/// to-function
const foo = async (msg: string): Promise<void> => {
  console.log(msg)
}
```

On the next `eslint --fix` (or auto-fix-on-save) it becomes:

```ts
async function foo(msg: string): Promise<void> {
  console.log(msg)
}
```

The trigger comment is one-off — it's removed along with the transformation.

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

### Neovim

A few ways to get format-on-save in Neovim:

- **`nvim-lspconfig`** exposes an `EslintFixAll` command. Create an autocmd that runs it on `BufWritePre`:

  ```lua
  lspconfig.eslint.setup({
    on_attach = function(client, bufnr)
      vim.api.nvim_create_autocmd('BufWritePre', {
        buffer = bufnr,
        command = 'EslintFixAll',
      })
    end,
  })
  ```

- [`conform.nvim`](https://github.com/stevearc/conform.nvim)
- [`none-ls.nvim`](https://github.com/nvimtools/none-ls.nvim)
- [`nvim-lint`](https://github.com/mfussenegger/nvim-lint)

### Editor Specific Disables

When ESLint runs inside a code editor, a handful of rules are **disabled for auto-fix** so the editor doesn't aggressively rewrite code you're still typing:

- [`prefer-const`](https://eslint.org/docs/rules/prefer-const)
- [`test/no-only-tests`](https://github.com/levibuzolic/eslint-plugin-no-only-tests)
- [`unused-imports/no-unused-imports`](https://www.npmjs.com/package/eslint-plugin-unused-imports)
- `pnpm/json-enforce-catalog`
- `pnpm/json-prefer-workspace-settings`
- `pnpm/json-valid-catalog`

> Since `@antfu/eslint-config` v3.16.0 these rules are not disabled — they're made **non-fixable** in editor mode. They still report, just without a quick-fix action.

Motivation: an unused import you just pasted shouldn't vanish the moment your editor auto-saves. The rules still apply when you run `eslint` in the terminal or through [Lint Staged](#lint-staged). If you prefer the uniform behaviour across editor and CLI, opt out:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  isInEditor: false,
})
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

## Versioning Policy

`@pleaseai/eslint-config` follows [Semantic Versioning](https://semver.org/), but because it's an opinionated style preset with many moving parts, **rule changes are not treated as breaking changes**. The tables below match the policy inherited from `@antfu/eslint-config`.

### Considered breaking

- Node.js version requirement changes
- Large refactors that may break downstream configs
- Major plugin upgrades that may break existing rules
- Changes that likely affect most codebases

### Considered non-breaking

- Enabling/disabling individual rules or plugins (even if stricter)
- Changing rule options
- Dependency version bumps

If a rule tightening breaks your lint, pin to a previous minor version and open an issue so we can discuss the trade-off.

## FAQ

### Prettier?

This config uses ESLint for both linting and formatting, so Prettier is not needed. See [Why I don't use Prettier](https://antfu.me/posts/why-not-prettier) by Anthony Fu.

If you need to format files that ESLint cannot handle yet (`.css`, `.html`, etc.), use the [formatters](#formatters) option instead.

### How to format CSS?

You can opt-in to the [`formatters`](#formatters) feature to format your CSS. Note that it only does formatting, not linting. If you want proper linting support, give [`stylelint`](https://stylelint.io/) a try.

### Top-level function style?

PleaseAI re-enables `antfu/top-level-function` on top of `lessOpinionated: true`, so top-level functions should use a `function` declaration rather than an arrow assigned to a `const`:

```ts
// ✓ preferred
export function greet(name: string) {
  return `Hello, ${name}`
}

// ✗ flagged
export const greet = (name: string) => `Hello, ${name}`
```

Arrow functions are still fine inside function bodies, as callbacks, or for inline JSX handlers — the rule only targets top-level declarations. If you disagree with this choice, override it:

```ts
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  rules: {
    'antfu/top-level-function': 'off',
  },
})
```

### Curly braces style?

PleaseAI defaults to `lessOpinionated: true`, which enforces `curly: ['error', 'all']` — always require braces around control flow bodies:

```js
// PleaseAI style — always requires braces
function example() {
  if (foo) {
    return true
  }
}
```

The antfu default (`lessOpinionated: false`) allows brace-less single-line `if` with a newline, but PleaseAI enforces `curly: ['error', 'all']`.

Note: `antfu/top-level-function` is re-enabled, so top-level `function` declarations are still preferred over arrow functions.

## Re-exports

All exports from `@antfu/eslint-config` are re-exported, so you can import fine-grained configs directly:

```js
import { combine, javascript, typescript, vue } from '@pleaseai/eslint-config'
```

## License

[MIT](./LICENSE)
