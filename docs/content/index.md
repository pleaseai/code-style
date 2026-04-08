---
title: PleaseAI Code Style
description: Shared code style configurations for PleaseAI projects.
navigation: false
---

# PleaseAI Code Style

Shared ESLint, Prettier, and EditorConfig configurations for consistent code style across PleaseAI projects.

## Packages

::card-group
  ::card{title="ESLint Config" icon="i-lucide-shield-check" to="/eslint-config"}
  Opinionated ESLint flat config built on top of `@antfu/eslint-config`.
  ::

  ::card{title="Prettier Config" icon="i-lucide-paintbrush" to="/prettier-config"}
  Shared Prettier configuration for consistent formatting.
  ::

  ::card{title="EditorConfig" icon="i-lucide-file-cog" to="/editorconfig"}
  Shared `.editorconfig` for consistent editor settings.
  ::
::

## Quick Start

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
