# Product Guide

What `@pleaseai/code-style` is for, who uses it, and the constraints that shape it. Read it before proposing a new package, option, or default.

## Vision

`@pleaseai/code-style` gives every PleaseAI project (outsourced, open source, and internal) the same code style with one install. It ships shared configs as npm packages and a CLI that applies and checks them, so a project gets consistent formatting, linting, and agent-navigable code organization without hand-tuning each tool.

## Target users

- **Developers starting or onboarding a project** who run `please-style` (the `@pleaseai/code-style` CLI) to install ESLint, Prettier, EditorConfig, ast-grep, and `AGENTS.md` defaults.
- **Developers maintaining an existing project** who consume `@pleaseai/eslint-config` directly and opt into stricter rule sets (`antislop`, `quality`, `formatters.markdown: 'bun'`).
- **Coding agents** working in those projects, which rely on predictable structure (greppable symbols, dedicated error files, no in-source tests) enforced by the ast-grep rules.

## Packages

| Package                     | Path                       | Role                                                                      |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `@pleaseai/code-style`      | `packages/cli`             | CLI: set up code style in a project, `doctor`, `update`, `check` paths    |
| `@pleaseai/eslint-config`   | `packages/eslint-config`   | ESLint flat config wrapping `@antfu/eslint-config` with PleaseAI defaults |
| `@pleaseai/prettier-config` | `packages/perttier-config` | Shared Prettier config (JSON)                                             |
| `@pleaseai/editorconfig`    | `packages/editorconfig`    | Shared `.editorconfig`                                                    |
| `@pleaseai/ast-grep-config` | `packages/ast-grep-config` | ast-grep rules for agent-navigable code (engineering-standards ADR-0022)  |

The docs site (`apps/docs`) publishes the guides at https://code-style.pages.dev in English and Korean.

## Core features

- Opinionated defaults on top of `@antfu/eslint-config`: 2-space indent, single quotes, no semicolons, `lessOpinionated` with `curly: all`, top-level `function` declarations.
- Opt-in stricter rule sets that stay off by default so upgrades do not flood existing projects with errors (`antislop`, `quality`, `strict`).
- A CLI that installs the selected tools, reports missing pieces (`doctor`), and checks code organization (`check`).

## Constraints

- ESM only, Node >= 22, Bun >= 1.4.4.
- Public OSS repository: English for docs and code; npm publishing with provenance.
- Rule changes are not treated as breaking changes (inherited from `@antfu/eslint-config`), so new strict rules ship as opt-in options.
