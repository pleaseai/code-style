---
title: PleaseAI Code Style
description: Shared code style configurations for PleaseAI projects.
navigation: false
---

# PleaseAI Code Style

Shared ESLint, Prettier, and EditorConfig configurations for consistent code style across PleaseAI projects — plus a CLI that wires them all up in one command.

## Packages

:::card-group
  ::card
  ---
  title: ESLint Config
  icon: i-lucide-shield-check
  to: /eslint-config
  ---
  Opinionated ESLint flat config built on top of `@antfu/eslint-config`.
  ::

  ::card
  ---
  title: Prettier Config
  icon: i-lucide-paintbrush
  to: /prettier-config
  ---
  Shared Prettier configuration for consistent formatting.
  ::

  ::card
  ---
  title: EditorConfig
  icon: i-lucide-file-cog
  to: /editorconfig
  ---
  Shared `.editorconfig` for consistent editor settings.
  ::

  ::card
  ---
  title: CLI
  icon: i-lucide-terminal
  to: /cli
  ---
  One-command setup for eslint, prettier, editorconfig, and the `AGENTS.md` rules block.
  ::
:::

## Quick Start

The fastest path is the CLI — it installs the packages and writes the config files for you:

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
