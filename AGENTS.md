<!-- eslint-disable markdown/no-multiple-h1 -- turbo-managed block below adds its own H1 -->

# @pleaseai/code-style

Monorepo providing shared code style configurations for PleaseAI projects.

## Tech Stack

- Tool versions: mise (`mise.toml` pins node 24 + bun 1.3.14; `mise trust && mise install`)
- Package manager: bun (>=1.3.14)
- Build orchestration: Turborepo
- Module system: ESM only (`"type": "module"`)
- Node: >=22.0.0
- TypeScript target: ES2022, moduleResolution: bundler

## Packages

| Package | Path | Build |
|---------|------|-------|
| `@pleaseai/code-style` | `packages/cli` | tsdown |
| `@pleaseai/eslint-config` | `packages/eslint-config` | tsdown |
| `@pleaseai/prettier-config` | `packages/perttier-config` | none (JSON only) |
| `@pleaseai/editorconfig` | `packages/editorconfig` | none (static file) |
| `@pleaseai/ast-grep-config` | `packages/ast-grep-config` | none (ast-grep YAML rules) |
| `@pleaseai/bun-lint-config` | `packages/bun-lint-config` | none (committed, generated `lint.toml`) |

## Commands

- `bun install` - Install dependencies
- `bun run build` - Build all packages via Turborepo
- `bun run lint` - Lint repo (dogfoods own eslint-config)
- `bun run lint:fix` - Lint with auto-fix

## Architecture

- `packages/eslint-config` wraps `@antfu/eslint-config` with PleaseAI defaults (2-space indent, single quotes, no semi)
- `packages/eslint-config/src/package-json.ts` exports `eslint-plugin-package-json` configs
- Root `eslint.config.ts` dogfoods `@pleaseai/eslint-config`
- `packages/ast-grep-config` holds the ADR-0022 (engineering-standards) layer-2 ast-grep rules in `rules/<lang>/<id>.yml` (each with a sibling `<id>.md` README, rule tests in `rule-tests/`) and the layer-3 extraction rules in `extract/` (never in `ruleDirs`); `@ast-grep/cli` is a peer. Run `bun run test` in the package (`ast-grep test` + the e2e sgconfig test)
- `packages/bun-lint-config` ships `lint.toml`, the `bunfig.toml` `[lint]` tables generated from `@pleaseai/eslint-config` (`canonicalPluginNames: true`) by `bun run generate` (`src/generate.ts`), keeping only the rules in `builtin-rules.json` (plus the rules `src/rule-map.ts` maps onto a native rule, whose target the source owns), a committed snapshot of `bun lint`'s native rules (`BUN_LINT_BIN=<canary bun> bun run update-rules`). A test fails when `lint.toml` is stale, so regenerate after changing eslint-config. The CLI's `bun-lint-config` tool writes it into `bunfig.toml` as a marker block
- `packages/cli/src/check/` is the `please-style check` path checker (layer 3). It resolves the `@ast-grep/cli` binary from the checked project first, then from the CLI's own install (`src/check/ast-grep.ts`), and the `extract/` rules from the CLI's own `@pleaseai/ast-grep-config` copy first (the project's copy is a last resort). `@pleaseai/ast-grep-config` is a regular `dependency` of the CLI; `@ast-grep/cli` is an optional peer of both packages (never a `dependency`, so installs do not download the native binary), installed explicitly only when the user selects the ast-grep tool. Tests live in `packages/cli/test/` mirroring `src/`, shared helpers in `test/test-utils/` (the CLI dogfoods its own rule)

## Code Style

- Follow @antfu/eslint-config conventions: no semicolons, single quotes, 2-space indent
- ESM imports only, no CommonJS

## Release

- Uses release-please (Google) for automated versioning and changelogs
- Config: `release-please-config.json` + `.release-please-manifest.json`
- Publishing: GitHub Actions workflow publishes to npm on release

## Docs Site

- Located at `apps/docs/` (`@pleaseai/code-style-docs`) — [Nimbus](https://github.com/cloudflare/nimbus) (Astro 7 + Tailwind v4), static output deployed to the Cloudflare Pages project `code-style`
- Bun workspace member (`apps/*`); `bun run build` (turbo) builds it to `apps/docs/dist/`
- Dev / build / deploy: `bun run docs:dev`, `bun run docs:build`, `bun run docs:deploy` (`wrangler pages deploy`)
- Checks inside `apps/docs`: `bun run typecheck` (`astro check`), `bun run lint:docs` (Nimbus prose/MDX lint)
- Content: `apps/docs/src/content/docs/{en,ko}/` (MDX). Every page must exist in both locales at the same path; order pages with `sidebar.order` frontmatter
- i18n is wired by hand with Astro's i18n routing: `apps/docs/src/i18n/` (locales, UI strings, translation lookup), `<html lang>` + `hreflang` in `BaseLayout.astro`, language switcher in `Header.astro`
- Nimbus is pre-1.0 — keep its dependencies pinned to exact versions; upgrade from `apps/docs` with `npx @cloudflare/nimbus-docs migrate` / `outdated` / `diff` (see `apps/docs/AGENT.md`)
- ADRs: `docs/adr/` (current: `0003-migrate-docs-to-nimbus.md`)

## Gotchas

- `packages/perttier-config` directory is intentionally(?) misspelled — do not rename without coordinating release-please config, CI workflows, and npm package name
- `bunfig.toml` sets `linker = "hoisted"` — introduced for the former Docus site (Bun 1.3.2+ defaults to the `isolated` linker in workspaces, which broke Nitro's `rollup-plugin-inject` on Docus's raw `.ts` files). The Nimbus site has not been verified without it, so keep it until removing it is tested across all workspace packages.
- `apps/docs/src/components/ui/**` and `apps/docs/src/layouts/DocsLayout.astro` are kept as close to upstream Nimbus as possible and excluded from ESLint, so `nimbus-docs diff --apply` / `nimbus-docs add <slug> --overwrite` can update them. Local edits are limited to `aside`, `card`, `pagination`, and `search` (links and i18n strings from `src/i18n/locales.ts`); merge those by hand on upgrade.
- Docs URLs are file-style (`build.format: 'file'`, `trailingSlash: 'never'`): `/en/cli` is served from `en/cli.html`. Don't switch to directory format — Cloudflare Pages would redirect `/en/cli` to `/en/cli/`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
