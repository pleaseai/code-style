# `dart-error-outside-errors-file`

| | |
| --- | --- |
| Slug | `code-error-types-in-dedicated-module` |
| Language | Dart / Flutter (`.dart`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

When a library's error and exception types live in one designated file, an
agent that needs to throw, catch, or match one knows where to look
(`errors.dart`) without reading every file. Scattered exception classes get
duplicated, because nobody finds the existing one.

## What the rule matches

ast-grep has no type information, so the rule matches a class declaration when
any of these is true:

- its superclass name ends in `Error` or `Exception` (`extends Error`,
  `extends AppException`);
- it implements a type whose name ends in `Error` or `Exception`
  (`implements Exception`, the usual Dart idiom);
- its own name ends in `Error` or `Exception` and it has a superclass or an
  `implements` clause.

## Wrong

```dart
// lib/src/auth/token_store.dart
class InvalidTokenException implements Exception {
  InvalidTokenException(this.message);
  final String message;
}

class TokenStore {
  // …
}
```

## Right

```dart
// lib/src/auth/errors.dart
class InvalidTokenException implements Exception {
  InvalidTokenException(this.message);
  final String message;
}
```

```dart
// lib/src/auth/token_store.dart
import 'errors.dart';

class TokenStore {
  // …
}
```

## How to fix

1. Open `errors.dart` in the directory of the file that declares the type;
   create it if it does not exist.
2. Move the class there unchanged.
3. Add `import 'errors.dart';` (or the relative path) to every file that uses
   it. If the type is part of the package's public API, export it from the
   library entry (`export 'src/auth/errors.dart';`).
4. Run `dart analyze` to catch files that lost the import.

Only the location is checked. `errors.dart` may contain helpers and imports.

## Exempt files

`errors.dart` and test code (`*_test.dart`, anything under `test/`,
`integration_test/`, or `test_driver/`) are ignored.
