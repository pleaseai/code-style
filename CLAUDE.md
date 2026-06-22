# @pleaseai/code-style

Monorepo providing shared code style configurations for PleaseAI projects.

## Tech Stack

- Package manager: bun (>=1.3.14)
- Build orchestration: Turborepo
- Module system: ESM only (`"type": "module"`)
- Node: >=22.0.0
- TypeScript target: ES2022, moduleResolution: bundler

## Packages

| Package | Path | Build |
|---------|------|-------|
| `@pleaseai/eslint-config` | `packages/eslint-config` | tsdown |
| `@pleaseai/prettier-config` | `packages/perttier-config` | none (JSON only) |
| `@pleaseai/editorconfig` | `packages/editorconfig` | none (static file) |

## Commands

- `bun install` - Install dependencies
- `bun run build` - Build all packages via Turborepo
- `bun run lint` - Lint repo (dogfoods own eslint-config)
- `bun run lint:fix` - Lint with auto-fix

## Architecture

- `packages/eslint-config` wraps `@antfu/eslint-config` with PleaseAI defaults (2-space indent, single quotes, no semi)
- `packages/eslint-config/src/package-json.ts` exports `eslint-plugin-package-json` configs
- Root `eslint.config.ts` dogfoods `@pleaseai/eslint-config`

## Code Style

- Follow @antfu/eslint-config conventions: no semicolons, single quotes, 2-space indent
- ESM imports only, no CommonJS

## Release

- Uses release-please (Google) for automated versioning and changelogs
- Config: `release-please-config.json` + `.release-please-manifest.json`
- Publishing: GitHub Actions workflow publishes to npm on release

## Docs Site

- Located at `docs/` — Docus (Nuxt) deployed to Cloudflare Pages
- Bun workspace member; build works because of `bunfig.toml` hoisted linker (see Gotchas)
- Build: `cd docs && bun run build` → outputs to `docs/dist/`
- Deploy: `cd docs && bun run deploy` (wrangler)
- ADR: `docs/adr/0001-choose-documentation-framework.md`

## Gotchas

- `packages/perttier-config` directory is intentionally(?) misspelled — do not rename without coordinating release-please config, CI workflows, and npm package name
- `bunfig.toml` sets `linker = "hoisted"` — required for Docus to build. Bun 1.3.2+ defaults to `isolated` linker in workspaces, which puts Docus's raw `.ts` server files under `.bun/` symlinks where Nitro's `rollup-plugin-inject` chokes on them. Hoisted linker (npm-style flat `node_modules`) avoids this.
- Docs build requires `mcp: { enabled: false }` in `docs/nuxt.config.ts` — `@nuxtjs/mcp-toolkit` imports `agents/mcp` (Cloudflare Workers AI Agents) which breaks the `cloudflare_pages` preset.
- Docus `cloudflare_pages` preset outputs to `dist/`, not `.output/public/` — `wrangler.jsonc` `pages_build_output_dir` must match.
