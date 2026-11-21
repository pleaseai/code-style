# Plan: Opt-in `strict` rule set for @pleaseai/eslint-config

> Track: opt-in-strict-rules-20261121
> Spec: [spec.md](./spec.md)

## Overview

- **Source**: /please:plan
- **Track**: opt-in-strict-rules-20261121
- **Issue**: #96
- **Created**: 2026-11-21
- **Approach**: a `strict()` block inserted where `quality()` goes, plus a merge of `eslint-plugin-import-x`'s `no-self-import` into the default `import` plugin
- **Plan Depth**: standard
- **Planned At**: 2bb246c

## Context

### Problem

`pleaseai()` (`packages/eslint-config/src/index.ts`) has no switch for the five Cloudflare-derived checks in the spec, and `import/no-self-import` does not exist in the default import plugin (`eslint-plugin-import-lite`).

Facts checked against the installed packages:

- antfu appends the `options.rules` config after `disables()`, and `userConfigs` after that. A block inserted before `antfu/disables/scripts` (as `quality()` is) overrides antfu's `eqeqeq: ['error', 'smart']` and is still overridden by the user (FR-7).
- Rules need `files: [GLOB_SRC]`. Applied without it, `unicorn/prefer-set-has` fails with "rules do not support the language markdown/gfm".
- import-lite is named `import` only through `autoRenamePlugins`. With `autoRenamePlugins: false` it stays `import-lite`. In the `canonicalPluginNames` mode `import` is `eslint-plugin-import`, which has `no-self-import`.
- `eslint-plugin-import-x` 4.18.1 supports ESLint 10, ships `no-self-import`, and resolves paths with its bundled `unrs-resolver` when no resolver is configured.
- Probe of this repository with the four non-import rules: 86 `eqeqeq` (mostly `== null` in `packages/cli`) and 1 `unicorn/prefer-set-has`, in 17 files.

### STOP Conditions

- import-x's `no-self-import` does not report inside the merged plugin (for example, it needs `import-x/*` settings). Stop and report; do not vendor or rewrite the rule.

### Non-Goals

Considered and not built:

- A runtime "is import-x installed" check: it is a regular dependency, so a missing copy is a broken install.
- Replacing `eslint-plugin-import` in the canonical mode: it exists so Bun's `bun lint` runs `import/*` natively (#56). Swapping it needs a new `bun lint --doctor` measurement, so it is a follow-up issue.

## Architecture Decision

`src/strict.ts` returns a `pleaseai/strict/rules` config shaped like `quality()`'s: `files: [GLOB_SRC]`, `ignores: [GLOB_MARKDOWN_CODE]`, every rule at `error`, and `eqeqeq: ['error', 'always']`. A rule whose plugin antfu does not load is left out, so ESLint never fails with "Could not find plugin". That covers `typescript`, `unicorn` and `imports` set to `false`.

The block uses `ts/…`. The canonical mode's existing `renamePlugins` call runs after `insertBefore`, so it renames the rule to `@typescript-eslint/…` with no special case.

For the self-import rule:

- Default mode: `composer.replacePlugin(name, original => ({ ...original, rules: { ...original.rules, 'no-self-import': … } }))`, where `name` is `import`, or `import-lite` when `autoRenamePlugins` is false. import-x is loaded by dynamic import inside the callback, so projects without `strict` never load it (NFR-1). It is a regular `dependency` (user decision).
- Canonical mode: no merge. `eslint-plugin-import` already provides the rule.

Rejected: import-x under its own name (the rule ID would be `import-x/no-self-import`, breaking FR-5), and a local reimplementation (the user chose a dependency).

## Tasks

- [x] T001 Add the `strict` option with the four non-import rules and strict `eqeqeq` (file: packages/eslint-config/src/strict.ts) [FR-1, FR-2, FR-3, FR-4, FR-6, FR-7, NFR-1, NFR-2, AC-001, AC-002, AC-003, AC-004, AC-005, AC-008, AC-009, AC-011, AC-012]
      Validation: AC-001 to AC-005, AC-008, AC-009, AC-011 and AC-012 hold. `strict` with `typescript: false` or `unicorn: false` lints without a missing-plugin error. A user `eqeqeq` setting still wins. Markdown files and code blocks get no strict findings and no language error.
      Method: `bun test` in `packages/eslint-config` (a `describe('strict')` block in `test/index.test.ts`, modeled on the `quality` cases)
- [x] T002 Report `import/no-self-import` under `strict` in both plugin modes (file: packages/eslint-config/src/index.ts) (depends on T001) [FR-5, AC-006, AC-007]
      Validation: AC-006 and AC-007 hold. With `autoRenamePlugins: false` the finding is `import-lite/no-self-import`. `imports: false` lints without a missing-plugin error. Without `strict`, the import plugin is import-lite's own object. `eslint-plugin-import-x` is in `dependencies` and `bun.lock`.
      Method: `bun test` in `packages/eslint-config`, linting a fixture that imports itself
      STOP: see `### STOP Conditions`
- [x] T003 Turn `strict` on in this repository and fix its findings (file: eslint.config.ts) (depends on T002) [FR-9, AC-010]
      Validation: AC-010 holds. Each `== null` / `!= null` rewrite keeps its meaning. The first-run counts per rule are recorded in the Decision Log.
      Method: `bun run build && mise exec -- bun run lint` and `bun run test` at the root
      STOP: a comparison whose operand types cannot be read from the code, so a rewrite might change behavior
- [x] T004 Document `strict` (file: packages/eslint-config/README.md) (depends on T003) [FR-8]
      Validation: FR-8 holds in `README.md`, `README.ko.md` and `apps/docs/src/content/docs/{en,ko}/eslint-config/advanced.mdx`, each in a section after `quality`. It notes that the default mode installs `eslint-plugin-import-x` and the canonical mode uses `eslint-plugin-import`. The `PleaseaiOptions.strict` JSDoc and `docs/knowledge/tech-stack.md` are updated.
      Method: `mise exec -- bun run lint` at the root, then `bun run typecheck && bun run lint:docs` in `apps/docs`

## Key Files

- `packages/eslint-config/src/index.ts`, `src/strict.ts` (new), `src/quality/index.ts` (pattern)
- `packages/eslint-config/test/index.test.ts`
- `packages/eslint-config/package.json`, `bun.lock`
- `eslint.config.ts`

## Verification

- [ ] `bun run build` and `bun run test` pass
- [ ] `mise exec -- bun run lint` passes at the root with `strict: true`
- [ ] `bun run typecheck` and `bun run lint:docs` pass in `apps/docs`
- [ ] Every AC from AC-001 to AC-012 maps to a T001 or T002 test, or to T003's lint run

## Review Focus

- `typescript`, `unicorn` or `imports` set to `false` (T001, T002).
- `autoRenamePlugins: false` (T002).
- `canonicalPluginNames` with `strict` (T001, T002).
- A user's own `eqeqeq` setting (T001).
- Non-JS languages and Markdown code blocks (T001).

## Progress

- [x] (2026-11-21 KST) T001 Add the `strict` option with the four non-import rules and strict `eqeqeq` (file: packages/eslint-config/src/strict.ts)
      Evidence: `cd packages/eslint-config && bun test` → 354 pass, 0 fail (new `strict` describe: 6 tests); `bunx eslint packages/eslint-config/src packages/eslint-config/test/index.test.ts` → clean
- [x] (2026-11-21 KST) T002 Report `import/no-self-import` under `strict` in both plugin modes (file: packages/eslint-config/src/index.ts)
      Evidence: `cd packages/eslint-config && bun test` → 360 pass, 0 fail (new `strict import/no-self-import` describe: 6 tests, lints test/fixtures/self-import.mjs via `lintFiles`); eslint on src and test → clean; `tsc --noEmit` → clean
- [x] (2026-11-21 KST) T003 Turn `strict` on in this repository and fix its findings (file: eslint.config.ts)
      Evidence: `bun run build && bun run lint` → exit 0, no findings; root `bun run test` → 5 turbo tasks successful (eslint-config 360 pass, 0 fail); `tsc --noEmit` on packages/cli and packages/ast-grep-config → clean
- [x] (2026-11-21 KST) T004 Document `strict` (file: packages/eslint-config/README.md)
      Evidence: `bun run lint` (root) → exit 0; `bun run typecheck` in apps/docs → 0 errors, 0 warnings, 0 hints; `bun run lint:docs` → 22 files lint clean

## Decision Log

- 2026-11-21: `eslint-plugin-import-x` as a regular dependency for the default mode (user decision). `eslint-plugin-import` was ruled out for its ESLint 10 peer range and its weight.
- 2026-11-21 (review): import-x's default resolver skips `.ts` files, so extensionless and `.js` self-imports in TypeScript went unreported. The default mode now gives import-x a node resolver with TypeScript extensions and `.js` → `.ts` aliases. For `canonicalPluginNames`, `eslint-import-resolver-typescript` became a regular dependency (user decision, following `nkzw-tech/eslint-config`), wired by absolute path because `eslint-plugin-import` loads resolvers relative to the linted file.
- Decision: The `strict` import rule is always `import/no-self-import`, including with `autoRenamePlugins: false` (task text expected `import-lite/no-self-import`).
  Rationale: antfu registers its import plugin natively as `import` and only renames `import-lite` rules; with `autoRenamePlugins: false` the plugin and its rules are still `import/*`, so the merge targets `replacePlugin('import', ...)` in both modes.
  Date/Author: 2026-11-21 / implement-executor
- Decision: First run of `strict: true` on this repository: 89 findings in 19 files: 86 `eqeqeq` (17 files), 2 `unicorn/prefer-set-has` (2 files), 1 `import/no-self-import` (1 file, the intentional self-import test fixture), 0 `no-promise-executor-return`, 0 `ts/no-confusing-non-null-assertion`.
  Rationale: Counted before fixing, from `eslint . --no-cache -f json`. Every `x == null` / `x != null` was rewritten from the type checker's type for the operand: `=== null` when only `null` is in the type, `=== undefined` when only `undefined` is, both checks for `any`/`unknown` and for values read from runtime data (parsed `package.json`, ast-grep `vars`, `spawnSync().error`). The fixture is excluded in `eslint.config.ts` instead of using an eslint-disable comment.
  Date/Author: 2026-11-21 / implement-executor

## Surprises & Discoveries
