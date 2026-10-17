# `bun lint` compatibility tracking

Tracks how `@pleaseai/eslint-config` behaves under Bun's built-in `bun lint`, until `bun lint` ships in a stable Bun release. Discussion: [#56](https://github.com/pleaseai/code-style/issues/56).

- **Status:** tracking — `bun lint` is canary-only (stable `1.4.3` has no `lint` command)
- **Last checked:** 2026-10-17, canary `1.4.4-canary.1+5f5799ed1` (built from a 2026-10-15 commit)
- **Exit condition:** a stable Bun release includes `bun lint`; re-run the [re-check procedure](#re-check-procedure) on it, post the result to #56, and decide on the proposal there

## Current results

Config under test: this repo's `eslint.config.ts` (`@pleaseai/eslint-config` on `@antfu/eslint-config` 9.5.1, `astro: true`), ESLint 10.12.0, 158 files.

| | As-is (`ts/`, `node/` names) | `.renamePlugins({ ts: '@typescript-eslint', node: 'n' })` |
| --- | --- | --- |
| Native / JS rules (`--doctor`) | 103 / 253 | 129 / 227 (+26, all typescript-eslint) |
| Files handed to the installed ESLint | 56 by `--doctor` (yml, json, toml, jsonc, yaml); 112 per `--timing` | same |
| Findings vs. ESLint (22-problem fixture) | identical rule, line, column | identical after the prefix change, except below |
| Existing `eslint-disable … ts/…` comment | works | becomes an **error**: `Definition for rule 'ts/no-explicit-any' was not found` |
| Whole repo, 3 runs (ESLint: 5.1–5.5 s) | 4.7–5.3 s | 4.6–6.2 s |

On a repo this size the fixed cost dominates: one JS engine loading 3,544 modules (~1.2 s) and the ESLint package linting 112 files. The gains #56 measured on a ~2,250-file repo do not show here.

## Findings

1. **`eslint-plugin-n` is only partly native.** Bun maps `n`/`node` to `eslint-plugin-n` 18.4.1, but only some of its rules run natively: `n/no-process-exit` does; `n/no-sync`, `n/no-path-concat`, and `n/no-exports-assign` don't. None of the 8 `node/*` rules antfu enables (`handle-callback-err`, `no-deprecated-api`, `no-exports-assign`, `no-new-require`, `no-path-concat`, `prefer-global/buffer`, `prefer-global/process`, `process-exit-as-throw`) run natively, renamed or not. Renaming `node` → `n` gains nothing today; only the `ts` → `@typescript-eslint` rename moves rules.
2. **A `lint` script in `package.json` shadows the built-in.** Here `bun lint` runs `eslint . --cache`. Only `--doctor` reaches the built-in linter. Bun's docs describe `bun lint --no-script`, but the tested canary rejects it. Measurements above were taken from a throwaway worktree with the `lint` script removed.
3. **`--doctor` suggests removing a package the config imports.** It prints `You can remove: @pleaseai/eslint-config` although `eslint.config.ts` imports it. Consumers would see the same advice. Not yet reported upstream.
4. **antfu defines its `test` plugin inside the config.** `--timing` reports `loaded the whole config file for the plugin "test"`, so every thread evaluates the whole config. Bun's docs list this as a slowdown.
5. **Locally, lint needs a build first.** On a fresh checkout `bun run lint` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` until `packages/eslint-config/dist` exists. CI runs `bun run build` before linting.

## Watch list

| Item | State on 2026-10-17 | Re-check |
| --- | --- | --- |
| `bun lint` in a stable release | not released (stable `1.4.3`) | `npm view bun dist-tags`, then `bun lint --help` on `latest` |
| `--no-script` | in the docs, not in canary `5f5799ed1` | `bun lint --no-script --doctor` |
| JSON and Markdown run natively ([oven-sh/bun#45595](https://github.com/oven-sh/bun/pull/45595), merged 2026-10-17) | not in the tested canary: 15 `@eslint/markdown` rules in JS | `--doctor` counts for `@eslint/markdown` and files handed to ESLint |
| Extglob `overrides[].files` on the oxlint config path ([oven-sh/bun#45470](https://github.com/oven-sh/bun/issues/45470)) | fixed by [oven-sh/bun#45482](https://github.com/oven-sh/bun/pull/45482) (2026-10-16), not in the tested canary | only matters for an oxlint config; the ESLint config path already matched |
| `eslint-plugin-n` native coverage | antfu's 8 enabled rules all in JS | `--doctor` with the renamed config |
| `--doctor` removal advice for `@pleaseai/eslint-config` | present | `--doctor` "You can remove" line |
| TypeScript 7 | `7.0.2` out; `@typescript-eslint/parser` 8.71.2 requires `typescript <6.1.0` | `npm view @typescript-eslint/parser peerDependencies.typescript` |
| `eslint-plugin-astro` / `astro-eslint-parser` 3.x | released; antfu accepts them (`>=`); untested here | upgrade in a branch and lint |

## Re-check procedure

Use a Bun binary outside the project so the project's pinned Bun stays untouched:

```bash
mkdir -p /tmp/bun-canary && cd /tmp/bun-canary
gh release download canary -R oven-sh/bun -p 'bun-linux-x64.zip' --clobber
unzip -oq bun-linux-x64.zip
B=/tmp/bun-canary/bun-linux-x64/bun
$B --revision
```

For a stable release, download that release's tag instead of `canary`. The `canary` release title shows a stale commit; trust `--revision`.

Then, from the repository root (after `bun run build`):

```bash
# Native vs. JS split
$B lint --doctor

# Canonical-name variant
cat > eslint.config.canonical.tmp.ts <<'EOF'
import base from './eslint.config'

export default base.renamePlugins({ ts: '@typescript-eslint', node: 'n' })
EOF
$B lint --doctor --config eslint.config.canonical.tmp.ts

# Results and timing (needs --no-script, or a worktree with the lint script removed)
npx eslint . -f json -o /tmp/eslint.json
$B lint --no-script -f json -o /tmp/bunlint.json
$B lint --no-script --config eslint.config.canonical.tmp.ts -f json -o /tmp/bunlint-canon.json
$B lint --no-script --timing

rm eslint.config.canonical.tmp.ts
```

Compare the JSON reports by `file:line:column ruleId`, normalizing `@typescript-eslint/` → `ts/` and `n/` → `node/` for the renamed run. The repo lints clean, so add a fixture with violations (including an `eslint-disable-next-line ts/…` comment) to compare findings.

## Log

| Date | Bun | Result |
| --- | --- | --- |
| 2026-10-17 | `1.4.4-canary.1+5f5799ed1` | Baseline above |
