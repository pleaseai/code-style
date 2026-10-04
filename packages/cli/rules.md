# PleaseAI Code Style Rules

Canonical rules for `@pleaseai/code-style`. The `@pleaseai/eslint-config` package
(based on `@antfu/eslint-config`) is the single source of truth — this document
summarises the parts that an AI coding assistant needs to know _before_ writing
code, so generated output passes lint on the first try.

## Formatting

- **No semicolons** at the end of statements.
- **Single quotes** for strings; template literals are fine when interpolating.
- **2-space indentation**, never tabs.
- **Trailing commas** in multi-line arrays, objects, and parameter lists.
- **LF** line endings.
- Soft line length ~100, hard limit 120.

## Modules

- **ESM only** (`"type": "module"`). Never emit `require`/`module.exports`.
- Use `import` / `export` statements.
- Source extensions: `.ts`, `.tsx`, `.mjs`, `.mts`.
- Import ordering (auto-fixable): node builtins → external → internal aliases →
  parent → sibling → index, with a blank line between groups and alphabetised
  within each group.
- Use **named exports** so one name search finds the definition and every use.
  Default exports are only for files whose shape a framework dictates (config
  files, Nuxt 4 `app/pages/`/`app/layouts/`/`app/middleware/`/`app/plugins/`, Nitro
  `server/api/`/`routes/`, Storybook stories). The `ts-no-default-export`
  rule of `@pleaseai/code-organization` lists the exact paths.

## TypeScript

- `target: ES2022`, `moduleResolution: bundler`.
- `strict: true` — no implicit `any`, no unchecked indexed access hacks.
- Prefer `type` aliases over `interface` unless `extends`/declaration merging
  is actually needed.
- Use `const` by default; `let` only when reassignment is required; never `var`.
- Avoid `any`; use `unknown` and narrow, or define a precise type.
- Add explicit return types on exported functions and public class methods.
- No unused imports or variables (auto-removed by `eslint --fix`).

## Code Quality

- Prefer **early returns** over deeply nested conditionals.
- Use **optional chaining** (`?.`) and **nullish coalescing** (`??`).
- Prefer `async`/`await` over raw `.then()` chains.
- No `console.log` in production code paths — use a logger or remove before
  commit. `console.warn`/`console.error` are acceptable for CLI tooling.
- Throw `Error` instances (or subclasses), never bare strings or objects.

## File Organisation

- One primary export per file when practical. A file with a single public
  symbol is named after it in kebab-case (`UserService` → `user-service.ts`).
- Target file size ≤ 500 lines; split when a file grows past that.
- Put a module's error classes in its `errors.ts`.
- Avoid barrel re-exports (`index.ts` that just re-exports everything) for
  internal modules — they defeat tree-shaking.

## Testing

- Tests live under the package's test root, `test/` or `tests/` (one per
  package), at a path mirrored from the source they test, with a `.test.ts`
  (or `.spec.ts`) suffix:
  - one source root: drop its name — `src/foo/bar.ts` → `test/foo/bar.test.ts`;
  - several roots (Nuxt 4 `app/`, `server/`, `shared/`): keep it —
    `server/utils/db.ts` → `test/unit/server/utils/db.test.ts`.
- One environment segment is allowed directly under the test root: `unit`,
  `nuxt`, `browser`, or `e2e`. End-to-end tests with no single source file go
  under `test/e2e/`.
- Never write `*.test.ts` next to the source, and never use Vitest in-source
  tests (`if (import.meta.vitest)`).
- Helpers shared by two or more test files go in `test/test-utils/`; a helper
  used by one test file stays in that file.
- Not every source file needs a test. These rules say where a test goes, not
  whether it must exist.

These are the `@pleaseai/code-organization` rules (ADR-0022). Check them with
`ast-grep scan` (structural rules) and `please-code-org check` (file names and
test paths); each warning links to a README that explains the fix.

## JSON & `package.json`

- `package.json` keys are sorted by `eslint-plugin-package-json`.
- Declare `engines.node` (>= 22 for PleaseAI projects).
- Libraries must ship an explicit `exports` map; no bare `main`-only fields.
- `"type": "module"` is required.

## Commit Messages

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, `build:`, `ci:`, `perf:`, `style:`, `revert:`.
- Subject ≤ 72 chars, imperative mood, no trailing period.
- Body explains **why**, not **what** — the diff already shows the what.
