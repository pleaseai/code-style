---
seo:
  title: PleaseAI Code Style
  description: Shared ESLint, Prettier, and EditorConfig configurations for consistent code style across PleaseAI projects.
navigation: false
---

<!-- eslint-disable markdown/no-missing-atx-heading-space -->

::u-page-hero
#title
PleaseAI Code Style

#description
Shared ESLint, Prettier, and EditorConfig configurations for consistent code style across PleaseAI projects — plus a CLI that wires them up in one command.

#links
  :::u-button
  ---
  color: neutral
  size: xl
  to: /en/cli
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  icon: i-simple-icons-github
  size: xl
  target: _blank
  to: https://github.com/pleaseai/code-style
  variant: outline
  ---
  Star on GitHub
  :::
::

::u-page-section
#title
Packages

#description
Everything you need for consistent code style, shipped as focused packages.

  :::u-page-grid
    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-shield-check
    spotlight: true
    to: /en/eslint-config
    ---
    #title
    ESLint Config

    #description
    Opinionated ESLint flat config built on top of `@antfu/eslint-config`.
    ::::

    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-paintbrush
    spotlight: true
    to: /en/prettier-config
    ---
    #title
    Prettier Config

    #description
    Shared Prettier configuration for consistent formatting.
    ::::

    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-file-cog
    spotlight: true
    to: /en/editorconfig
    ---
    #title
    EditorConfig

    #description
    Shared `.editorconfig` for consistent editor settings.
    ::::

    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-terminal
    spotlight: true
    to: /en/cli
    ---
    #title
    CLI

    #description
    One-command setup for eslint, prettier, editorconfig, and the `AGENTS.md` rules block.
    ::::
  :::
::

::u-page-section
#title
Quick Start

#description
The fastest path is the CLI — it installs the packages and writes the config files for you.

#body
:::code-group
```bash [bun]
bunx @pleaseai/code-style
```

```bash [pnpm]
pnpm dlx @pleaseai/code-style
```

```bash [npm]
npx @pleaseai/code-style
```
:::

Prefer to wire things up by hand? Install the ESLint config directly:

:::code-group
```bash [bun]
bun add -D @pleaseai/eslint-config eslint
```

```bash [pnpm]
pnpm add -D @pleaseai/eslint-config eslint
```

```bash [npm]
npm install -D @pleaseai/eslint-config eslint
```
:::

```ts [eslint.config.ts]
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
```
::
