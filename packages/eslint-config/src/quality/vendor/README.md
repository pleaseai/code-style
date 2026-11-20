# Vendored `quality` rules

This directory holds the upstream source of the `quality/*` rules behind the `quality` option. Read
it to see where the code came from, what was changed, and how to update it from upstream.

Copied from [`nkzw-tech/oxlint-config`](https://github.com/nkzw-tech/oxlint-config) `quality/` at
v3.0.1 (`eb1a3d1540974570341ca15047958e0a3c62d810`). Those rules are adapted from
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) at
`13909c9e07590f5a85d93c62712259fe14a883f7`. License: MIT, see [`LICENSE`](./LICENSE).

The rules use Oxlint's `createOnce` API. `../index.ts` wraps them with `eslintCompatPlugin()` from
`@oxlint/plugins` so ESLint can run them.

## Local changes

Oxlint nodes have `start` / `end` offsets, ESLint nodes do not. Six reads are changed to
`range[0]` / `range[1]`:

- `rules/no-reduce-accumulator-copy.js` (1)
- `rules/no-widen-then-assert.js` (3)
- `shared/function-parameters.js` (2)

The other upstream files are unchanged. This `README.md` and `index.d.ts`, which types `index.js`
for TypeScript, are local additions. The vendored files are excluded from this repository's lint so a
re-sync stays a plain diff.

## Re-sync

```bash
git clone https://github.com/nkzw-tech/oxlint-config /tmp/oxlint-config
cp -R /tmp/oxlint-config/quality/. packages/eslint-config/src/quality/vendor/
```

Then reapply the `range` changes above (`grep -rnE '\.(start|end)\b'` must find nothing), update
the commit in this file, and run `bun run test` in `packages/eslint-config`.
