# `kotlin-error-outside-errors-file`

| | |
| --- | --- |
| Slug | `code-error-types-in-dedicated-module` |
| Language | Kotlin (`.kt`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

When a package's exception types live in one designated file, an agent that
needs to throw or catch one knows where to look (`Errors.kt`) without reading
every file. Scattered exception classes get duplicated, because nobody finds
the existing one. The file name is PascalCase because ktlint
`standard:filename` requires that for a file with several declarations.

## What the rule matches

ast-grep has no type information, so the rule matches a `class` or `object`
declaration when either is true:

- one of its supertypes ends in `Error`, `Exception`, or `Throwable`
  (`: RuntimeException()`, `: AppException(msg)`);
- its own name ends in `Error` or `Exception` and it has any supertype.

## Wrong

```kotlin
// src/main/kotlin/com/acme/billing/InvoiceService.kt
package com.acme.billing

class InvoiceNotFoundException(id: String) : RuntimeException("invoice $id not found")

class InvoiceService { /* … */ }
```

## Right

```kotlin
// src/main/kotlin/com/acme/billing/Errors.kt
package com.acme.billing

class InvoiceNotFoundException(id: String) : RuntimeException("invoice $id not found")
```

```kotlin
// src/main/kotlin/com/acme/billing/InvoiceService.kt
package com.acme.billing

class InvoiceService { /* … */ }
```

## How to fix

1. Open `Errors.kt` in the same package directory; create it if it does not
   exist, with the same `package` line.
2. Move the declaration there. A top-level `private` class is visible only in
   its own file, so widen it to `internal` (or drop the modifier) when the
   original file still uses it. Code in the same package needs no import
   change; code in other packages keeps importing it by its unchanged fully
   qualified name.
3. If `Errors.kt` ends up with a single top-level declaration, ktlint
   `standard:filename` asks for the class name instead. Disable that rule for
   `Errors.kt` in `.editorconfig` (`[**/Errors.kt]` →
   `ktlint_standard_filename = disabled`).

## Exempt files

`Errors.kt` and test source sets (`src/test/`, `src/testFixtures/`,
`src/androidTest/`) are ignored.
