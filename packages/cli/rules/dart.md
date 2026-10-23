# Passion Factory Code Style Rules — Dart

Dart rules for `@pleaseai/code-style`, condensed from Effective Dart (style,
documentation, usage, design). `dart format` sets the layout and `dart analyze`
checks the rest. Read it together with `general.md` in this directory.

## Naming and Files

- Name types, extensions, and enums in `UpperCamelCase`; name packages,
  directories, source files, and import prefixes in `lowercase_with_underscores`;
  name everything else (members, top-level values, variables, parameters,
  constants) in `lowerCamelCase`.
- A file is named after its primary type in snake_case: `UserRepository` lives
  in `user_repository.dart`.
- Capitalize acronyms and abbreviations longer than two letters like words
  (`HttpClient`, `Uri`). A two-letter one keeps its English capitalization
  (`ID`, `UI`, but `Mr`).
- Do not use prefix letters (`kDefaultTimeout`), a leading underscore on a
  public name, or the `library` directive to name a library.
- Use `_` for unused callback parameters.
- Name a boolean with a non-imperative verb phrase in the positive form
  (`isEnabled`, `canClose`), not `isDisabled`.
- Start a method name with a verb only when its main job is a side effect
  (`list.add()`); do not start one with `get`. Use `toX()` for a copy and `asX()`
  for a view backed by the original.

## Formatting and Imports

- Format with `dart format`; keep lines at 80 characters or fewer.
- Use curly braces for every `if`, `for`, `while`, `do`, and `try` body.
- Order imports: `dart:` first, then `package:`, then relative paths; put
  `export` directives in their own section after the imports; sort each section
  alphabetically.
- Do not import another package's `src/` directory, and do not use an import
  path that reaches into or out of `lib`. Prefer relative imports within a
  package.

## Documentation

- Document public APIs with `///` doc comments; use `//` for implementation
  comments and never `/* */` for documentation.
- Start each doc comment with a one-sentence summary in its own paragraph. Do
  not repeat the name of the thing being documented.
- Write comments as sentences: capitalized, ending with a period. Start a
  method comment with a third-person verb ("Connects to…") or a noun phrase for
  a value; start a boolean comment with "Whether".
- Refer to identifiers with square brackets (`[StateError]`) and explain
  parameters, return values, and exceptions in prose. Put doc comments before
  annotations.
- Document either the getter or the setter of a property, not both.

## Usage

- Do not initialize a variable to `null` or use `null` as an explicit default.
  Do not compare a `bool` to `true` or `false`.
- Avoid `late` when you need to check whether the variable is initialized;
  use a nullable type.
- Use interpolation instead of `+` for strings, and omit braces when
  interpolating a plain identifier (`'$name'`).
- Use collection literals. Check emptiness with `isEmpty` / `isNotEmpty`, never
  `length`. Prefer `for-in` to `Iterable.forEach` with a closure, `toList()` to
  `List.from()`, and `whereType()` to filter by type.
- Use a function declaration to bind a name to a function, and a tear-off
  instead of a lambda that only forwards its arguments.
- Use initializing formals (`this.field`), `;` for empty constructor bodies, and
  no `new` or redundant `const`.
- Use `this.` only to avoid shadowing or to redirect to a named constructor.
  Do not wrap a field in a trivial getter and setter.
- Use `final` for locals that are not reassigned, and do not store what you can
  compute from other fields.
- Prefer `async` / `await` to raw `Future` chains, and do not mark a function
  `async` when it has no effect.

## Error Handling

- Do not write a `catch` without an `on` clause, and never discard the error.
- Throw an `Error` subtype only for programmer mistakes, and do not catch
  `Error`. Throw an `Exception` for conditions callers can recover from.
- Use `rethrow` to rethrow a caught exception so its stack trace survives.
- Put a library's error and exception classes in `errors.dart` in the same
  directory as the code that throws them (checked by the
  `dart-error-outside-errors-file` ast-grep rule). `errors.dart` may hold
  helpers; test code is exempt.

## API Design

- Make declarations private (`_`) unless they are part of the API, and make
  fields and top-level variables `final` where possible.
- Make a constructor `const` when every field is `final`.
- Use class modifiers (`final`, `interface`, `sealed`) to state whether a class
  may be extended or implemented. Do not define a class that holds only static
  members or a one-method abstract class that a function type could replace.
- Use a getter for a cheap, idempotent property read and a setter only together
  with a getter. Do not return `this` from a method just for chaining; use
  cascades.
- Return an empty collection or a non-nullable `Future` of a nullable value
  instead of a nullable `Future`, `Stream`, or collection.
- Annotate types on fields, top-level variables, return types, and parameters
  of declarations. Leave out the annotation on initialized locals and on inferred
  function-expression parameters. Avoid `dynamic` unless you mean to disable
  static checks.
- Avoid positional `bool` parameters; use named ones.
- Override `hashCode` whenever you override `==`, keep `==` consistent with it,
  and do not define custom equality on mutable classes.

## Testing

- Tests live under `test/`, mirroring the path of the `lib/` file they test,
  with a `_test.dart` suffix: `lib/src/auth/token_store.dart` →
  `test/src/auth/token_store_test.dart`.
- End-to-end tests with no single source file go in `integration_test/` or
  `test_driver/`.
- Helpers shared by two or more test files go in `test/helpers/`.

## Sources

- [Effective Dart: Style](https://dart.dev/effective-dart/style),
  [Documentation](https://dart.dev/effective-dart/documentation),
  [Usage](https://dart.dev/effective-dart/usage), and
  [Design](https://dart.dev/effective-dart/design)
- [Conductor Dart summary](https://github.com/gemini-cli-extensions/conductor/blob/main/skills/conductor-setup/assets/code_styleguides/dart.md)

See `NOTICE.md` for licenses.
