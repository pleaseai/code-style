# @pleaseai/code-style

Monorepo providing shared code style configurations for PleaseAI projects.

## Tech Stack

- Package manager: bun (>=1.3.10)
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

## Gotchas

- `packages/perttier-config` directory is intentionally(?) misspelled — do not rename without coordinating release-please config, CI workflows, and npm package name
