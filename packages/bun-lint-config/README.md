# @pleaseai/bun-lint-config

English | [한국어](./README.ko.md)

The rules of [`@pleaseai/eslint-config`](../eslint-config) that
[`bun lint`](https://bun.com/docs/lint) runs natively, as the `[lint]` tables
of a `bunfig.toml`. The package ships one file, `lint.toml`, generated from
the ESLint config; nothing in it is written by hand.

`bun lint` is only in Bun canary builds for now. bunfig.toml has no `extends`,
so the tables are copied into your project's `bunfig.toml`.

## What it covers

`lint.toml` is generated from
`pleaseai({ canonicalPluginNames: true, typescript: true, vue: false })`.
`canonicalPluginNames` names the rules the way Bun runs them
(`@typescript-eslint/*`, and `import/*` from `eslint-plugin-import`). The
generator keeps:

- the rules Bun has built in: ESLint core, `@typescript-eslint`, `unicorn`,
  `import`, and `node` (`eslint-plugin-n`), with their options;
- the file scoping of the ESLint config, as `[[lint.overrides]]` for
  TypeScript files, tests, scripts, `.d.ts`, config files, and so on;
- the global ignores, as `ignorePatterns`.

What is left out:

- plugins Bun does not run natively: stylistic (`style/*`), `regexp`, `jsdoc`,
  `antfu`, `perfectionist`, `unused-imports`, `eslint-comments`, `command`,
  and `e18e`;
- vitest rules, which antfu registers as `test/*`;
- JSON, YAML, TOML, and Markdown, which `bun lint` does not lint;
- formatting. This package configures `[lint]` only, not `[fmt]`.

An `off` setting is written only where it turns off a rule that is on by
default in Bun or that an earlier table turns on.

## Usage

### With `please-style`

```bash
bunx @pleaseai/code-style init   # select bun-lint-config
```

`init` installs this package and writes `lint.toml` into `bunfig.toml` between
`# >>> @pleaseai/bun-lint-config` and `# <<< @pleaseai/bun-lint-config`
comments. Run `init` again after an upgrade to refresh the block; the rest of
`bunfig.toml` is kept. If `bunfig.toml` already sets lint options outside the
block, `init` leaves the file alone and asks you to remove them first.

### By hand

```bash
bun add -D @pleaseai/bun-lint-config
cat node_modules/@pleaseai/bun-lint-config/lint.toml >> bunfig.toml
```

Keep the tables at the end of `bunfig.toml`: a key after them belongs to the
last table. Copy the file again after an upgrade.

`bun --config=node_modules/@pleaseai/bun-lint-config/lint.toml lint` is not
the same: `--config` replaces `bunfig.toml` instead of adding to it, so the
rest of your bunfig settings are not read.

### Running `bun lint`

- A `lint` script in `package.json` shadows `bun lint`: `bun lint` runs the
  script. Run `bun lint --no-script`, or make the script `bun lint`.
- Do not use this next to an `eslint.config.*` file. Next to an ESLint config,
  `bun lint` reads that config and applies the `[lint]` keys on top of it, so
  pick one of the two.

## Regenerating

`lint.toml` is generated from two inputs: `@pleaseai/eslint-config` and
`builtin-rules.json`, a committed snapshot of the rules Bun runs natively. A
test fails when `lint.toml` is out of date with either of them.

```bash
# Refresh the snapshot from a Bun build that has `bun lint`.
BUN_LINT_BIN=/path/to/bun-canary bun run update-rules
# Regenerate lint.toml.
bun run generate
```

The generator fails when the ESLint config uses a glob that Bun.Glob cannot
express (an extglob other than `?(…)`) or a rule option that TOML cannot
represent (`null`, a function, or a regular expression).

## License

MIT
