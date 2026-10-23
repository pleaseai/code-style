# Passion Factory Code Style Rules — General

Rules for `@pleaseai/code-style` that apply to every language. Read this file
together with the guide for the language you are writing (for example
`typescript.md` in this directory).

## Principles

- Write for the reader: plain constructs over clever or obscure ones.
- Follow the patterns already in the codebase — naming, structure, and
  formatting stay consistent with the surrounding code.
- Prefer the simple solution; break a complex problem into smaller parts.
- Keep dependencies and coupling low so code stays easy to change.
- Comments and docs explain **why**, not **what**, and change in the same
  commit as the code they describe.

## Code Quality

- Prefer **early returns** over deeply nested conditionals.

## File Organisation

- Target file size ≤ 500 lines; split when a file grows past that.

## Testing

- Follow the language guide's test layout where it defines one. Otherwise,
  keep the project's existing test layout and the language's conventions.
- Helpers shared by two or more test files go in the language's designated
  location: `<test-root>/test-utils/` for TypeScript (`test/test-utils/` or
  `tests/test-utils/`), `test/helpers/` for Dart, and `src/testFixtures/` for
  Kotlin and Java. A helper used by one test file stays in that file. In Rust,
  a helper shared by two or more integration test targets goes in
  `tests/common/`.
- Not every source file needs a test. These rules say where a test goes, not
  whether it must exist.

These are the ADR-0022 code-organization rules. Check them with `ast-grep scan`
(structural rules from `@pleaseai/ast-grep-config`) and `please-style check`
(file names and test paths); each `ast-grep scan` warning links to a README
that explains the fix.

## Commit Messages

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, `build:`, `ci:`, `perf:`, `style:`, `revert:`.
- Subject ≤ 72 chars, imperative mood, no trailing period.
- Body explains **why**, not **what** — the diff already shows the what.
