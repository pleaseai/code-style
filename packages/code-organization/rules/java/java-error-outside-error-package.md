# `java-error-outside-error-package`

| | |
| --- | --- |
| Slug | `code-error-types-in-dedicated-module` |
| Language | Java (`.java`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

Java needs one public top-level class per file, so a module's exceptions
cannot share a file. They share a package instead: `<module>/error/`. An agent
that needs to throw or catch one looks there without reading the whole module,
and existing exceptions are found instead of duplicated.

## What the rule matches

ast-grep has no type information, so the rule matches a class declaration when
either is true:

- its superclass ends in `Error`, `Exception`, or `Throwable`
  (`extends RuntimeException`, `extends AppException`);
- its own name ends in `Error` or `Exception` and it extends anything.

## Wrong

```java
// src/main/java/com/acme/billing/InvoiceNotFoundException.java
package com.acme.billing;

public class InvoiceNotFoundException extends RuntimeException {
  public InvoiceNotFoundException(String id) {
    super("invoice " + id + " not found");
  }
}
```

## Right

```java
// src/main/java/com/acme/billing/error/InvoiceNotFoundException.java
package com.acme.billing.error;

public class InvoiceNotFoundException extends RuntimeException {
  public InvoiceNotFoundException(String id) {
    super("invoice " + id + " not found");
  }
}
```

## How to fix

1. Move the file into an `error` directory under the module's package
   (`com/acme/billing/` → `com/acme/billing/error/`).
2. Change its `package` line to match (`package com.acme.billing.error;`).
3. Update imports in the files that use it
   (`import com.acme.billing.error.InvoiceNotFoundException;`). Classes in the
   old package used it without an import, so they now need one. Compile
   (`./gradlew compileJava`) to list them.
4. If the class was package-private, make it `public` or move its users; a
   subpackage cannot see package-private types.

## Exempt files

Files under any `error/` directory and test source sets (`src/test/`,
`src/testFixtures/`) are ignored.
