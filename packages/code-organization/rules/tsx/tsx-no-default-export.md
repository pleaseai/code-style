# `tsx-no-default-export`

| | |
| --- | --- |
| Slug | `code-greppable-public-symbols` |
| Language | TSX (`.tsx`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

A default export has no name of its own. Every importer picks a local name, so
the same function can be `createUser` in one file and `makeUser` in another.
Searching for the symbol's name finds neither its definition nor all of its
uses. A named export is defined and imported under one name, so one search
finds everything.

## Wrong

```tsx
// user-card.tsx
export default function UserCard() {
  return <div />
}
```

```tsx
// importer
import Card from './user-card'
```

```tsx
export { UserCard as default }
```

## Right

```tsx
// user-card.tsx
export function UserCard() {
  return <div />
}
```

```tsx
// importer
import { UserCard } from './user-card'
```

## How to fix

1. Replace `export default <declaration>` with `export <declaration>`. For an
   anonymous value (`export default { … }`, `export default defineX(…)`), bind
   it to a `const` first: `export const config = defineX(…)`.
2. Pick the name the file is named after (see
   `code-filename-matches-primary-symbol`): `user-card.tsx` exports
   `UserCard`.
3. Update every importer from `import X from './file'` to
   `import { Name } from './file'`. `tsc --noEmit` lists the importers you
   missed.
4. Remove `{ foo as default }` from export lists; export `foo` under its name.

## Exempt files

Files whose shape a framework dictates are ignored by the rule: `*.d.ts`,
`*.config.tsx` (and `*.config.*.tsx`), `*.stories.tsx`, `.vitepress/**`, `.storybook/**`, Nuxt 4 `app/pages/`, `app/layouts/`,
`app/middleware/`, `app/plugins/`, `app/app.config.ts`,
`app/router.options.ts`, and Nitro `server/api/`, `server/routes/`,
`server/middleware/`, `server/plugins/`, `server/tasks/`.

### Nuxt 3 layouts (no `app/` directory)

A Nuxt 3-style project keeps `pages/`, `layouts/`, `middleware/`, and
`plugins/` at the project root. Those paths are **not** allowlisted: a glob
such as `**/plugins/**` would also exempt every unrelated directory named
`plugins`, silently switching the rule off there.

Do not add `ast-grep-ignore` comments; they are suppressions that review and
floor-guard flag. ast-grep has no per-project override of a shipped rule's
`ignores` (a local copy with the same `id` is rejected as a duplicate), so
scope the rule from the command line instead: turn it off in the main scan and
run it once more with your framework directories excluded.

```sh
ast-grep scan --off=tsx-no-default-export
ast-grep scan --filter '^tsx-no-default-export$' \
  --globs '!pages/**' --globs '!layouts/**' \
  --globs '!middleware/**' --globs '!plugins/**' --globs '!app.config.ts'
```

Put both commands in one package script (for example `lint:structure`) so CI
and agents run the same thing. Migrating to the Nuxt 4 `app/` layout removes
the need for the second command.

If another framework requires a default export somewhere else, propose the
path for the allowlist in `@pleaseai/code-organization`.
