# Product Guidelines

Rules for how configuration options, documentation, and releases are designed in this repository. Check a new option or doc change against them before opening a PR.

## Configuration design

- **Defaults stay stable; strictness is opt-in.** A rule set that reports many findings on existing code (for example `quality: true`, which reported 4,396 findings in a 2,669-file monorepo) ships behind an option that is off by default.
- **Mirror upstream option shapes.** `pleaseai()` accepts every `@antfu/eslint-config` option; new options follow the same naming and boolean/object style.
- **Dogfood every option.** This repository lints itself with its own config, and an option is turned on here once its findings are fixed.
- **Record measurements.** When an option is added or turned on, the README states the finding counts it produced and links the issue with the measurements.

## Documentation

- Every user-facing option is documented in `packages/eslint-config/README.md` and `README.ko.md`, and in the docs site under `apps/docs/src/content/docs/{en,ko}/` at the same path.
- English prose follows the PassionFactory technical documentation style: active voice, second person, present tense, sentence-case headings, informative link text, reference links inside tables.
- Korean pages use consistent terminology with the existing Korean docs (for example "프리셋", "vendoring").

## Code style

- Follow `@antfu/eslint-config` conventions: no semicolons, single quotes, 2-space indent, ESM imports only.
- Vendored upstream code stays unmodified apart from documented local changes, and is excluded from this repository's lint so a re-sync stays a plain diff.

## Release

- Conventional Commits drive release-please versioning and changelogs; GitHub Actions publish to npm with provenance.
