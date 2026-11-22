# Opt-in `strict` rule set for @pleaseai/eslint-config

> Track: opt-in-strict-rules-20261121

## Overview

Add a `strict` option to `@pleaseai/eslint-config` that turns on a small set of stricter rules adopted from [`cloudflare/oxlint-config`](https://github.com/cloudflare/oxlint-config). The rules catch mistakes that the current defaults let through: a value returned from a Promise executor, a confusing non-null assertion next to an equality check, an array used only for membership checks, a module that imports itself, and loose equality against `null`. None of these rules need type information, so they work without `tsconfigPath`.

The option is off by default, following the product guideline that defaults stay stable and strictness is opt-in (the same approach as `antislop` and `quality`). Turning it on is one boolean; individual rules can still be turned off through `rules`. This repository turns the option on for itself once its findings are fixed, and the first-run finding counts are recorded in the README.

## Requirements

### Functional Requirements

- [x] FR-1: accept a boolean `strict` option in `pleaseai()`, off when unset.
- [x] FR-2: when `strict` is on, report a value returned from a Promise executor function (`no-promise-executor-return`).
- [x] FR-3: when `strict` is on, report a non-null assertion placed where it reads like part of an equality or assignment operator (`no-confusing-non-null-assertion`), reported under the same plugin prefix the config uses for other typescript-eslint rules (`ts/` by default, `@typescript-eslint/` with `canonicalPluginNames`).
- [x] FR-4: when `strict` is on, report an array that is only used for membership checks and could be a `Set` (`unicorn/prefer-set-has`).
- [x] FR-5: when `strict` is on, report a module that imports itself (`import/no-self-import`), in both the default plugin mode and the `canonicalPluginNames` mode.
- [x] FR-6: when `strict` is on, replace the default `eqeqeq` setting (`'smart'`, which allows `== null`) with strict equality everywhere, including comparisons against `null`.
- [x] FR-7: let a user turn off any single rule from FR-2 to FR-6 through `rules` while `strict` stays on.
- [x] FR-8: document the option in `packages/eslint-config/README.md`, `README.ko.md`, and the docs site page that covers `antislop` and `quality` (English and Korean), including what each rule reports, how to turn one off, and the finding counts this repository produced on the first run.
- [x] FR-9: turn `strict` on in this repository's own ESLint config and fix the findings it reports.

### Non-functional Requirements

- [x] NFR-1: Leave the lint results of a project that does not set `strict` unchanged.
- [x] NFR-2: Require no `tsconfigPath` or type information for any rule in the set.

## Acceptance Criteria

- [x] AC-001 (FR-1, NFR-1): When `pleaseai()` is called without `strict`, the resolved config shall contain none of the FR-2 to FR-5 rules.
- [x] AC-002 (FR-2): Where `strict` is on, when a Promise executor contains `return value`, the linter shall report `no-promise-executor-return`.
- [x] AC-003 (FR-3): Where `strict` is on, when a TypeScript file contains `a! == b`, the linter shall report `no-confusing-non-null-assertion` under `ts/` by default.
- [x] AC-004 (FR-3): Where `strict` and `canonicalPluginNames` are both on, when a TypeScript file contains `a! == b`, the linter shall report it as `@typescript-eslint/no-confusing-non-null-assertion`.
- [x] AC-005 (FR-4): Where `strict` is on, when a file declares a constant array and only calls `.includes()` on it, the linter shall report `unicorn/prefer-set-has`.
- [x] AC-006 (FR-5): Where `strict` is on and `canonicalPluginNames` is off, when a file imports its own path, the linter shall report `import/no-self-import`.
- [x] AC-007 (FR-5): Where `strict` and `canonicalPluginNames` are both on, when a file imports its own path, the linter shall report `import/no-self-import`.
- [x] AC-008 (FR-6): Where `strict` is on, when code compares `value == null`, the linter shall report `eqeqeq`.
- [x] AC-009 (FR-7): Where `strict` is on and the user sets `'unicorn/prefer-set-has': 'off'` in `rules`, the linter shall not report `unicorn/prefer-set-has`.
- [x] AC-010 (FR-9): When `bun run lint` runs in this repository with `strict` on, it shall report no findings from the FR-2 to FR-6 rules.
- [x] AC-011 (FR-1, NFR-1): When `pleaseai()` is called without `strict`, the resolved config shall keep `eqeqeq` at `'smart'`.
- [x] AC-012 (FR-7): Where `strict` is on and the user sets `'unicorn/prefer-set-has': 'off'` in `rules`, the linter shall still report the other FR-2 to FR-6 rules.

## Out of Scope

- The type-aware Cloudflare rules (`ts/no-unsafe-type-assertion`, `ts/use-unknown-in-catch-callback-variable`, `ts/only-throw-error`) and the other rules antfu already enables only with `tsconfigPath`.
- Cloudflare's test-file relaxations.
- A migration guide for adopting `strict`, `quality`, or `antislop` in an existing project.
- Changing any default: `strict` stays off unless a user sets it.
- Adopting Oxlint as a linter (tracked in #74 and #73).

## Assumptions

- `import/no-self-import` is not available in the default import plugin (`eslint-plugin-import-lite`). Per the user's decision, FR-5 is met in the default mode by adding `eslint-plugin-import-x` as a regular dependency (it supports ESLint 10), so turning on `strict` needs no extra install. In the `canonicalPluginNames` mode the rule comes from `eslint-plugin-import`, which that mode already requires. (Updated during implementation: the bundled resolver of `eslint-plugin-import-x` does not resolve TypeScript sources, so `eslint-import-resolver-typescript` is also a regular dependency and `strict` configures it as the resolver in both plugin modes; see the plan's Decision Log.)
- All rules report at `error` severity, matching Cloudflare's preset and the existing opt-in options.
- Rules apply to the same files the config already lints for each plugin: the typescript-eslint rule to TypeScript files, the others to JavaScript and TypeScript files.
- Attribution: rules are configured, not copied, so no Cloudflare source is vendored; the README references section already lists `cloudflare/oxlint-config`.
