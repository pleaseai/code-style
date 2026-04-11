# @pleaseai/code-style

English | [한국어](./README.ko.md)

CLI that wires PleaseAI's shared code style into any project — installs the
eslint/prettier/editorconfig packages and manages the `AGENTS.md` rules block
so AI coding assistants know how to write code that passes lint on the first
try.

Inspired by [ultracite](https://github.com/haydenbleasel/ultracite) and
NaverPay's [`@naverpay/code-style-cli`](https://github.com/NaverPayDev/code-style).

## Usage

From the root of any project that has a `package.json`:

```bash
bunx @pleaseai/code-style         # same as `init`
bunx @pleaseai/code-style init    # interactive setup
bunx @pleaseai/code-style update  # re-apply the AGENTS.md rules block only
bunx @pleaseai/code-style doctor  # check current project status
```

Also works with `npx`, `pnpm dlx`, and `yarn dlx`.

## What it does

The `init` command:

1. Detects your package manager (bun → pnpm → yarn → npm, based on lockfile).
2. Shows a checkbox UI listing PleaseAI code-style tools; already-installed
   ones are labelled `(installed)` / `(설치됨)`.
3. Installs the packages you selected as dev dependencies.
4. Writes / updates the corresponding config files.

### Supported tools

| Tool | npm package(s) | Config file |
| --- | --- | --- |
| eslint-config | `@pleaseai/eslint-config`, `eslint` | `eslint.config.mjs` |
| prettier-config | `@pleaseai/prettier-config`, `prettier` | `package.json#prettier` |
| editorconfig | `@pleaseai/editorconfig` | `.editorconfig` (copied from `node_modules`) |
| agents-md | — | `AGENTS.md` (marker-managed block) |

## `AGENTS.md` block

The CLI owns only the content between these markers — everything else in
`AGENTS.md` is your content and is preserved verbatim:

```md
<!-- pleaseai-code-style:start -->
...managed content...
<!-- pleaseai-code-style:end -->
```

Re-run `pleaseai-code-style update` any time you upgrade `@pleaseai/code-style`
to refresh just this block. The full rules list is shipped as
`node_modules/@pleaseai/code-style/rules.md` for reference.

## Options

| Flag | Description |
| --- | --- |
| `--yes`, `-y` | Accept defaults, overwrite existing files without prompting |
| `--lang <ko\|en>` | Force the CLI locale (defaults to `$LANG`) |
| `--help`, `-h` | Print help |
| `--version`, `-v` | Print version |

## Localisation

The CLI auto-detects your locale from `LC_ALL` / `LANG` / `LC_MESSAGES` and
currently ships Korean and English messages. Override with `--lang ko` or
`--lang en`.

## License

MIT
