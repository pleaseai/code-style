# `ts-no-default-export`

| | |
| --- | --- |
| Slug | `code-greppable-public-symbols` |
| Language | TypeScript (`.ts`, `.mts`, `.cts`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

A default export has no name of its own. Every importer picks a local name, so
the same function can be `createUser` in one file and `makeUser` in another.
Searching for the symbol's name finds neither its definition nor all of its
uses. A named export is defined and imported under one name, so one search
finds everything.

## Wrong

```ts
// user-service.ts
export default class UserService {}
```

```ts
// importer
import Service from './user-service'
```

```ts
export { createUser as default }
```

## Right

```ts
// user-service.ts
export class UserService {}
```

```ts
// importer
import { UserService } from './user-service'
```

## How to fix

1. Replace `export default <declaration>` with `export <declaration>`. For an
   anonymous value (`export default { … }`, `export default defineX(…)`), bind
   it to a `const` first: `export const config = defineX(…)`.
2. Pick the name the file is named after (see
   `code-filename-matches-primary-symbol`): `user-service.ts` exports
   `UserService`.
3. Update every importer from `import X from './file'` to
   `import { Name } from './file'`. `tsc --noEmit` lists the importers you
   missed.
4. Remove `{ foo as default }` from export lists; export `foo` under its name.

## Exempt files

Files whose shape a framework dictates are ignored by the rule: `*.d.ts`,
`*.config.{ts,mts,cts}` (and `*.config.*.ts`), `*.stories.ts`, `.vitepress/**`, `.storybook/**`, Nuxt 4 `app/pages/`, `app/layouts/`,
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
ast-grep scan --off=ts-no-default-export
ast-grep scan --filter '^ts-no-default-export$' \
  --globs '!pages/**' --globs '!layouts/**' \
  --globs '!middleware/**' --globs '!plugins/**' --globs '!app.config.ts'
```

Put both commands in one package script (for example `lint:structure`) so CI
and agents run the same thing. Migrating to the Nuxt 4 `app/` layout removes
the need for the second command.

If another framework requires a default export somewhere else, propose the
path for the allowlist in `@pleaseai/code-organization`.
