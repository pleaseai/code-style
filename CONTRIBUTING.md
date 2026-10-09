# Contributing

Thanks for your interest in contributing! This guide covers how to get from a clone to a merged pull request.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md). All documentation, code, comments, and commit messages in this repository are written in **English**.

## Repository layout

This is a [bun](https://bun.sh) monorepo orchestrated by [Turborepo](https://turbo.build).

| Package                     | Path                                                  | Notes                                            |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `@pleaseai/eslint-config`   | [`packages/eslint-config`](./packages/eslint-config)   | ESLint flat config, built with tsdown            |
| `@pleaseai/prettier-config` | [`packages/perttier-config`](./packages/perttier-config) | Shared Prettier config (JSON, no build)          |
| `@pleaseai/editorconfig`    | [`packages/editorconfig`](./packages/editorconfig)     | Shared `.editorconfig` (static file, no build)   |

The `packages/perttier-config` directory is intentionally misspelled. Do not rename it without coordinating the release-please config, CI workflows, and the npm package name.

The documentation site lives in [`docs/`](./docs) (Docus on Nuxt).

## Getting started

Tool versions are pinned in `mise.toml`.

```bash
git clone https://github.com/pleaseai/code-style.git
cd code-style
mise trust && mise install   # install pinned tool versions
bun install                   # install dependencies and set up git hooks
bun run build                 # build all packages
```

You must build before linting: the root ESLint config dogfoods the workspace `@pleaseai/eslint-config`, which has to be built first.

## Development workflow

1. Create a branch from `main` (e.g. `feat/short-description` or `fix/issue-123`).
2. Make focused changes. Keep each pull request to one logical change.
3. Run the checks below and make sure they pass.
4. Open a pull request and fill out the template.

```bash
bun run build       # build all packages via Turborepo
bun run lint        # lint and format (use `bun run lint:fix` to auto-fix)
```

To work on the docs site, use `bun run docs:dev` and `bun run docs:build`.

### Git hooks

`bun install` sets up [husky](https://typicode.github.io/husky/) hooks:

- `pre-commit` runs `lint-staged`, which runs `eslint --fix` on staged files.
- `commit-msg` runs `commitlint` and rejects messages that are not valid Conventional Commits.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, where `type` is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc. Breaking changes include a `BREAKING CHANGE:` footer. Versioning and changelogs are generated automatically by [release-please](https://github.com/googleapis/release-please) from these messages, so accurate types matter.

## Pull requests

- Reference the issue your PR addresses (e.g. `Closes #123`).
- Use a Conventional-Commit-style PR title. It becomes the squash-merge commit.
- Make sure CI is green before requesting review.

## Reporting bugs and requesting features

| You want to...                   | File it as...    | Humans                                                                              | Agents                                                                           |
| -------------------------------- | ---------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Report a bug or propose a fix    | an **Issue**     | [New issue](https://github.com/pleaseai/code-style/issues/new/choose)                 | [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE)                              |
| Request a feature or enhancement | a **Discussion** | [New discussion](https://github.com/pleaseai/code-style/discussions/categories/ideas) | [`.github/DISCUSSION_TEMPLATE/ideas.yml`](.github/DISCUSSION_TEMPLATE/ideas.yml) |

A well-framed problem is worth more to us than a finished PR. Send the clearest
account of the bug, or the strongest case for the feature, with the full context
that lets us guide the work. Accepted proposals are promoted to issues before
implementation, and if we take yours on, we credit you.

**Security vulnerabilities**: do not open a public issue. Follow
[SECURITY.md](./SECURITY.md).
