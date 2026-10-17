# `bun lint` compatibility tracking

Tracks how `@pleaseai/eslint-config` behaves under Bun's built-in `bun lint`, until `bun lint` ships in a stable Bun release. It also tracks two [upstream configs](#upstream-configs) for comparison: `@antfu/eslint-config`, which this package wraps, and `eslint-config-xo`, which registers canonical plugin names. Discussion: [#56](https://github.com/pleaseai/code-style/issues/56).

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

## Upstream configs

Both were measured in scratch projects (`/tmp/probe-*`) with the same canary, ESLint 10.13.0, TypeScript 6.0.3, typescript-eslint 8.71.2, and eslint-plugin-n 18.4.1. Fixtures are the same violation files plus 21 TS files copied from `packages/cli/src`.

| | `@antfu/eslint-config` 9.5.1 | `eslint-config-xo` 6.0.0 |
| --- | --- | --- |
| Plugin names | renamed (`ts`, `node`, `import`, `style`, `test`, …) | canonical (`@typescript-eslint`, `n`, `import-x`, `@stylistic`, `node-test`, …) |
| Native / JS rules (`--doctor`) | 102 / 242; renamed back: 128 / 216 | 246 / 638 (93 typescript-eslint + 153 core native) |
| Native typescript-eslint | only after `.renamePlugins({ ts: '@typescript-eslint' })` | yes, as-is |
| `n` rules native | 0 of 8 | 0 of 18 |
| `import` rules native | 0 of 6 (`eslint-plugin-import-lite`) | 0 of 22 (`eslint-plugin-import-x`; `--native-plugin-rules=import` changes nothing) |
| `prettier/prettier` | not used | native, with `prettier: true` |
| Type-aware rules | off by default | on (`projectService: true`); plain `bun lint` already runs them |
| Findings vs. ESLint, fixtures | identical (22) | identical (73), also vs. the `xo` 5.0.1 CLI |
| Findings vs. ESLint, whole project | identical | **16 missing, no warning**: 10 `unicorn/consistent-boolean-name`, 6 `regexp/*` |
| Non-JS files | JSON handed to ESLint; Markdown runs in JS | CSS, HTML, JSON, Markdown handed to ESLint; no unsupported-language errors |
| `--doctor` removal advice | none (correct) | none (correct) |
| Wall time vs. ESLint | no gain (2.7–3.3 s both) | ~1.5× faster (3.7 s vs. 5.5 s) |

The 16 missing problems come from plugin rules that read types through `parserServices` (unicorn's `getTypeAtLocation`, regexp's type checker). Bun gives types only to its native rules, so these JS rules see no types. They quietly report less, and `--doctor` still shows 0 rules not run. For unicorn this is confirmed by the missed pattern (`const ok = await confirmOverwrite(...)`, a boolean known only from types); for regexp it is inferred. This repo's config is not type-aware, so it does not hit this, but it would once antfu's type-aware mode (`typescript: { tsconfigPath }`) is turned on.

The false "You can remove: @pleaseai/eslint-config" advice does not appear with plain antfu or with eslint-config-xo. It seems specific to this repo's wrapper loaded through a workspace link.

### Upstream positions

- **antfu/eslint-config** keeps the `ts/` rename on purpose. [antfu/eslint-config#527](https://github.com/antfu/eslint-config/issues/527) added docs on renaming back, with antfu noting he "wouldn't recommend doing it with my config in particular". So canonical names have to come from this package (#56). Faster runners are tracked in [antfu/eslint-config#767](https://github.com/antfu/eslint-config/issues/767) (open, oxlint "NOT READY"). Its target is a drop-in runner that uses the config unchanged, which `bun lint` with an ESLint config already is. `bun lint` itself is not discussed there yet.
- **XO** won't switch from ESLint ([xojs/xo#872](https://github.com/xojs/xo/issues/872), not planned). Its rules are moving into `eslint-config-xo` "so should be easy to just use any ESLint compatible runner". Bun-specific problems are left to Bun ([xojs/xo#808](https://github.com/xojs/xo/issues/808)). The `xo` 5.0.1 CLI still depends on `eslint-config-xo` ^3.0.2, while 6.0.0 is the standalone flat config measured here.

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
| JS plugin rules get no types | 16 problems silently missed with eslint-config-xo | whole-project diff in `/tmp/probe-xo`; also antfu with `typescript: { tsconfigPath }` |
| `eslint-plugin-import-x` native | Bun lists it in its conformance versions, but all rules run in JS | `--doctor` with eslint-config-xo |
| antfu releases / [antfu/eslint-config#767](https://github.com/antfu/eslint-config/issues/767) | 9.5.1 (2026-09-02); #767 open | `gh release list -R antfu/eslint-config`; new comments on #767 mentioning Bun |
| `eslint-config-xo` releases / `xo` CLI catching up | 6.0.0 (2026-10-12); `xo` 5.0.1 on ^3.0.2 | `gh release list -R xojs/eslint-config-xo`; `npm view xo dependencies.eslint-config-xo` |

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

### Upstream configs

Use a new scratch directory per config, with `"type": "module"` and no `lint` script in `package.json`. Pin `typescript@~6.0`; typescript-eslint rejects 7.x.

```bash
# antfu
bun add -d eslint @antfu/eslint-config typescript@~6.0
echo "import antfu from '@antfu/eslint-config'; export default antfu()" > eslint.config.mjs

# eslint-config-xo (type-aware: add a tsconfig.json, plus @types/node with "types": ["node"])
bun add -d eslint eslint-config-xo typescript@~6.0 @types/node
echo "import xo from 'eslint-config-xo'; export default xo()" > eslint.config.js
```

Then run the same `--doctor`, JSON comparison, and timing steps as above. Copy real sources (such as `packages/cli/src`) into the scratch project too: the type-related misses only show up on real code, not on the small fixtures.

## Log

| Date | Bun | Result |
| --- | --- | --- |
| 2026-10-17 | `1.4.4-canary.1+5f5799ed1` | Baseline above |
| 2026-10-17 | `1.4.4-canary.1+5f5799ed1` | Added antfu 9.5.1 and eslint-config-xo 6.0.0 baselines |
