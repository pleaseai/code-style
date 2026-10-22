# `bun lint` compatibility tracking

Tracks how `@pleaseai/eslint-config` behaves under Bun's built-in `bun lint`, until `bun lint` ships in a stable Bun release. It also tracks two [upstream configs](#upstream-configs) for comparison: `@antfu/eslint-config`, which this package wraps, and `eslint-config-xo`, which registers canonical plugin names. Discussion: [#56](https://github.com/pleaseai/code-style/issues/56).

- **Status:** tracking — `bun lint` is canary-only (stable `1.4.4`, released 2026-10-22, has no `lint` command)
- **Last checked:** 2026-10-22, canary `1.4.4-canary.1+963452075` (npm `1.4.4-canary.20261022.1`, built from a 2026-10-21 commit)
- **Exit condition:** a stable Bun release includes `bun lint`; re-run the [re-check procedure](#re-check-procedure) on it, post the result to #56, and decide on the proposal there

## Current results

Config under test: this repo's `eslint.config.ts` (`@pleaseai/eslint-config` on `@antfu/eslint-config` 9.5.1, `astro: true`), ESLint 10.12.0, 158 files.

| | As-is (`ts/`, `node/` names) | `.renamePlugins({ ts: '@typescript-eslint', node: 'n' })` |
| --- | --- | --- |
| Native / JS rules (`--doctor`) | 118 / 238 | 144 / 212 (+26, all typescript-eslint) |
| Files handed to the installed ESLint | 56 by `--doctor` (yml, json, toml, jsonc, yaml); 78 per `--timing` | same |
| Findings vs. ESLint (30-problem fixture) | identical rule, line, column | identical after the prefix change, except below |
| Existing `eslint-disable … ts/…` comment | works | becomes an **error**: `Definition for rule 'ts/no-explicit-any' was not found` |
| Whole repo, 3 runs (ESLint: 4.5–5.2 s) | 4.0–4.1 s | 3.9 s |

Markdown now runs natively ([oven-sh/bun#45595](#oven-shbun45595-pr-build)), which adds 15 native rules and cuts the files handed to ESLint from 112 to 78. On a repo this size the fixed cost still dominates: one JS engine loading 3,544 modules (~1.0 s) and the ESLint package linting 78 files. At load average ~1.5, `bun lint` is ~1.2× faster than ESLint; the gains #56 measured on a ~2,250-file repo still do not show here. The 2026-10-17 baseline on `5f5799ed1` was 103 / 253 and 129 / 227, with no speedup at load average 5–8.

## Findings

1. **`eslint-plugin-n` is only partly native.** Bun maps `n`/`node` to `eslint-plugin-n` 18.4.1, but only some of its rules run natively: `n/no-process-exit` does; `n/no-sync`, `n/no-path-concat`, and `n/no-exports-assign` don't. None of the 8 `node/*` rules antfu enables (`handle-callback-err`, `no-deprecated-api`, `no-exports-assign`, `no-new-require`, `no-path-concat`, `prefer-global/buffer`, `prefer-global/process`, `process-exit-as-throw`) run natively, renamed or not. Renaming `node` → `n` gains nothing today; only the `ts` → `@typescript-eslint` rename moves rules.
2. **A `lint` script in `package.json` shadows the built-in.** Here `bun lint` runs `eslint . --cache`. Only `--doctor` and `--no-script` reach the built-in linter. `--no-script` works from canary `963452075` (canary `5f5799ed1` rejected it), and the measurements above use it.
3. **`--doctor` suggests removing a package the config imports.** It prints `You can remove: @pleaseai/eslint-config` although `eslint.config.ts` imports it. Consumers would see the same advice. Not yet reported upstream.
4. **antfu defines its `test` plugin inside the config.** `--timing` reports `loaded the whole config file for the plugin "test"`, so every thread evaluates the whole config. Bun's docs list this as a slowdown.
5. **Locally, lint needs a build first.** On a fresh checkout `bun run lint` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` until `packages/eslint-config/dist` exists. CI runs `bun run build` before linting.

## Upstream configs

Both were measured in scratch projects (`/tmp/probe-*`) with canary `5f5799ed1` (not re-measured on `963452075`), ESLint 10.13.0, TypeScript 6.0.3, typescript-eslint 8.71.2, and eslint-plugin-n 18.4.1. Fixtures are the same violation files plus 21 TS files copied from `packages/cli/src`.

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

| Item | State on 2026-10-22 | Re-check |
| --- | --- | --- |
| `bun lint` in a stable release | not released: stable `1.4.4+38afee6c8` (2026-10-22) has no `lint` command | `npm view bun dist-tags`, then `bun --help` on `latest` |
| `--no-script` | works in canary `963452075` | — (done) |
| JSON and Markdown run natively ([oven-sh/bun#45595](https://github.com/oven-sh/bun/pull/45595), merged 2026-10-17) | in canary `963452075`; this repo's counts match the PR build, see [below](#oven-shbun45595-pr-build) | `--doctor` counts for `@eslint/markdown` and files handed to ESLint |
| Extglob `overrides[].files` on the oxlint config path ([oven-sh/bun#45470](https://github.com/oven-sh/bun/issues/45470)) | fix ([oven-sh/bun#45482](https://github.com/oven-sh/bun/pull/45482), 2026-10-16) in canary `963452075`; not exercised here | only matters for an oxlint config; the ESLint config path already matched |
| `eslint-plugin-n` native coverage | antfu's 8 enabled rules all in JS | `--doctor` with the renamed config |
| `--doctor` removal advice for `@pleaseai/eslint-config` | present | `--doctor` "You can remove" line |
| TypeScript 7 | `7.0.2` out; `@typescript-eslint/parser` 8.72.0 requires `typescript <6.1.0` | `npm view @typescript-eslint/parser peerDependencies.typescript` |
| `eslint-plugin-astro` / `astro-eslint-parser` 3.x | released; antfu accepts them (`>=`); untested here | upgrade in a branch and lint |
| JS plugin rules get no types | 16 problems silently missed with eslint-config-xo | whole-project diff in `/tmp/probe-xo`; also antfu with `typescript: { tsconfigPath }` |
| `eslint-plugin-import-x` native | Bun lists it in its conformance versions, but all rules run in JS | `--doctor` with eslint-config-xo |
| antfu releases / [antfu/eslint-config#767](https://github.com/antfu/eslint-config/issues/767) | 9.5.1 (2026-09-02); #767 open | `gh release list -R antfu/eslint-config`; new comments on #767 mentioning Bun |
| `eslint-config-xo` releases / `xo` CLI catching up | 6.0.1 (2026-10-18); `xo` 5.0.1 on ^3.0.2 | `gh release list -R xojs/eslint-config-xo`; `npm view xo dependencies.eslint-config-xo` |

### oven-sh/bun#45595 (PR build)

[oven-sh/bun#45595](https://github.com/oven-sh/bun/pull/45595) builds in all 6 `@eslint/json` rules and all 21 `@eslint/markdown` rules. A file still goes to the installed ESLint when any rule on it is not built in. Measured on the PR's CI build `1.4.4-canary.1+a1ab4b531` (fetched with `bunx bun-pr 45595`; it does not include the oven-sh/bun#45482 fix):

| Config | Native / JS before | Native / JS with #45595 | Files to ESLint | Findings vs. ESLint |
| --- | --- | --- | --- | --- |
| this repo, as-is | 103 / 253 | 118 / 238 | 112 → 78 (`--timing`) | identical (0 / 0) |
| this repo, canonical names | 129 / 227 | 144 / 212 | same | — |
| `@antfu/eslint-config` 9.5.1 | 102 / 242 | 117 / 227 | 2 JSON | identical (26) |
| `eslint-config-xo` 6.0.0 | 246 / 638 | 266 / 638 | 6 → 3 (CSS, HTML, `package.json`) | same 16 type-related misses |

- **Markdown moves for antfu-based configs:** the 15 `@eslint/markdown` rules now run natively. Code blocks inside Markdown are still linted through the JS rules, with identical results.
- **JSON does not move for antfu-based configs.** antfu lints JSON with `eslint-plugin-jsonc` on `jsonc-eslint-parser`, not with `@eslint/json`, so all 17 JSON files still go to ESLint. eslint-config-xo uses `@eslint/json`, so its JSON files run natively, except `package.json`, where the `package-json` plugin is not built in.
- **Wall time on this repo stays about the same:** 4.3–5.5 s vs. ESLint's 5.3–6.0 s, at load average 5–8.
- **Canary `963452075` (2026-10-22) includes #45595** and reproduces this repo's rows: 118 / 238 as-is, 144 / 212 with canonical names, 78 files to ESLint. The antfu and eslint-config-xo rows were not re-measured.

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
| 2026-10-17 | `1.4.4-canary.1+5f5799ed1` | Baseline: 103 / 253 as-is, 129 / 227 renamed; no speedup |
| 2026-10-17 | `1.4.4-canary.1+5f5799ed1` | Added antfu 9.5.1 and eslint-config-xo 6.0.0 baselines |
| 2026-10-17 | `1.4.4-canary.1+a1ab4b531` (oven-sh/bun#45595 PR build) | Markdown native: +15 native rules for antfu-based configs; JSON stays on ESLint (`eslint-plugin-jsonc`) |
| 2026-10-22 | `1.4.4-canary.1+963452075` (npm `1.4.4-canary.20261022.1`) | #45595 and #45482 landed: 118 / 238 as-is, 144 / 212 renamed; `--no-script` works; findings identical; ~1.2× faster than ESLint. Stable `1.4.4` still has no `bun lint` |
