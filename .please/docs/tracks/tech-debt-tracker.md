# Tech Debt Tracker

> Tracked across all tracks. Updated during implementation and retrospectives.

## Active

| ID     | Source Track                 | Description                                                                                                                                                                        | Priority | Created    |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TD-001 | opt-in-strict-rules-20261121 | `StrictOptions.importPlugin` is `string \| false` but only ever `'import'` or `false`; make it a boolean                                                                           | Low      | 2026-11-22 |
| TD-003 | opt-in-strict-rules-20261121 | `packages/cli` keeps both `!== null` and `!== undefined` for runtime-data values after the `eqeqeq` rewrite; narrow each to its real sentinel or validate the data at the boundary | Low      | 2026-11-22 |
| TD-004 | opt-in-strict-rules-20261121 | strict's `eslint-import-resolver-typescript` finds `tsconfig.json` only from the process cwd, so `paths` aliases of a project linted from elsewhere are not resolved               | Low      | 2026-11-22 |

## Resolved

| ID     | Source Track                 | Description                                                                                                               | Resolved In | Date       |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| TD-002 | opt-in-strict-rules-20261121 | `readPackageJson` now rejects a `package.json` that is not a JSON object, so `commands.ts` no longer needs a `null` guard | PR #97      | 2026-11-22 |
