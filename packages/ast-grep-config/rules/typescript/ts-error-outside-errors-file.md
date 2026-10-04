# `ts-error-outside-errors-file`

| | |
| --- | --- |
| Slug | `code-error-types-in-dedicated-module` |
| Language | TypeScript (`.ts`, `.mts`, `.cts`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

When a module's error types live in one designated file, an agent that needs
to throw, catch, or narrow an error knows where to look (`errors.ts`) without
reading every file. Scattered error classes get duplicated, because nobody
finds the existing one.

## What the rule matches

ast-grep has no type information, so the rule matches a class declaration when
either is true:

- it extends a class whose name ends in `Error` or `Exception`
  (`extends Error`, `extends TypeError`, `extends errors.AppError`), or
- its own name ends in `Error` or `Exception` and it extends anything
  (`class PaymentDeclinedError extends DomainBase`).

## Wrong

```ts
// billing/invoice-service.ts
export class InvoiceNotFoundError extends Error {
  constructor(id: string) {
    super(`invoice ${id} not found`)
  }
}

export function findInvoice(id: string) {
  // …
}
```

## Right

```ts
// billing/errors.ts
export class InvoiceNotFoundError extends Error {
  constructor(id: string) {
    super(`invoice ${id} not found`)
  }
}
```

```ts
// billing/invoice-service.ts
import { InvoiceNotFoundError } from './errors'

export function findInvoice(id: string) {
  // …
}
```

## How to fix

1. Find the module the class belongs to (usually the directory of the file
   that declares it) and open its `errors.ts`; create the file if it does not
   exist.
2. Move the class there unchanged and export it by name.
3. In the original file, import it from `./errors` (or the relative path to
   that module's `errors.ts`). Re-export it from the module's public entry if
   it was part of the public API.
4. Run `tsc --noEmit` to catch importers that still point at the old file.

Only the location is checked. `errors.ts` may contain helpers and imports.

## Exempt files

`errors.ts`, `*.d.ts`, and test code (`*.test.ts`, `*.spec.ts`, anything under
`test/` or `tests/`) are ignored.
