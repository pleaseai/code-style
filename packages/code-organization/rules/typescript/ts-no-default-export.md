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
`*.config.{ts,mts,cts}` (and `*.config.*.ts`), `*.stories.ts`, `.vitepress/**`,
`.storybook/**`, Nuxt `pages/`, `layouts/`, `middleware/`, `plugins/`,
`app.config.ts`, `router.options.ts` (with or without the Nuxt 4 `app/`
prefix), and Nitro `server/api/`, `server/routes/`, `server/middleware/`,
`server/plugins/`, `server/tasks/`. If a framework you use requires a default
export somewhere else, add the path to the allowlist in
`@pleaseai/code-organization` instead of suppressing the warning.
