## Resolution report

Hello. The request in #96 is done, and here is a summary.

**What was missing**: `@pleaseai/eslint-config` had no switch for the stricter checks used in Cloudflare's lint config. It could not catch a value returned from a Promise executor, a confusing non-null assertion next to an equality check, an array used only for membership checks, a module that imports itself, or a loose `== null` comparison.

**What changed**: A new `strict` option turns these five checks on. It is off by default, so existing projects see no change until they opt in. Any single rule can still be turned off in `rules`. Your own per-plugin overrides and your own import resolver settings take precedence over `strict`.

**How to check it**: Set `pleaseai({ strict: true })` in your `eslint.config.ts` and run ESLint. Loose `== null` comparisons and modules that import themselves (including through a tsconfig `paths` alias) are now reported. With `canonicalPluginNames`, install `eslint-plugin-import` as before.

**Release status**: PR #97 is under review and will ship in the next `@pleaseai/eslint-config` release after it merges.

If you run into anything unexpected, let us know. Thank you.
