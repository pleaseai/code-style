# Tech Stack

The languages, tools, and services this repository uses, with the versions pinned where they matter. Update it before introducing or replacing a tool.

## Language and module system

- TypeScript, target ES2022, `moduleResolution: bundler`
- ESM only (`"type": "module"`), no CommonJS

## Runtime and tooling

- Node 24 and Bun 1.4.4, pinned in `mise.toml` (`mise trust && mise install`)
- Package manager: Bun workspaces (`packages/*`, `apps/*`), `bunfig.toml` sets `linker = "hoisted"`
- Build orchestration: Turborepo (`turbo.json`: `build`, `test`, `lint`)
- Bundler: tsdown (`packages/cli`, `packages/eslint-config`)
- Git hooks: husky, commitlint (`@commitlint/config-conventional`), lint-staged running `eslint --cache --fix`

## Testing

- `bun test` in each package (`packages/*/test/`)
- `ast-grep test` for the rules in `packages/ast-grep-config`

## Key dependencies

- `@pleaseai/eslint-config`: `@antfu/eslint-config` 9.x, ESLint 10, `@oxlint/plugins` (runs the vendored `quality/*` rules in ESLint), `eslint-plugin-package-json`; optional peers `eslint-plugin-import`, `eslint-plugin-slop`, `eslint-plugin-sonarjs`
- `@pleaseai/code-style` (CLI): `@clack/prompts`, `@pleaseai/ast-grep-config`; optional peer `@ast-grep/cli`

## Docs site

- `apps/docs`: Astro 7 with Nimbus (`@cloudflare/nimbus-docs`, pinned to exact versions) and Tailwind v4
- Static output deployed to the Cloudflare Pages project `code-style` with Wrangler

## CI and release

- GitHub Actions: `ci.yml` (lint, test), `release-please.yml`
- release-please (`release-please-config.json`, `.release-please-manifest.json`) and npm publishing with provenance
