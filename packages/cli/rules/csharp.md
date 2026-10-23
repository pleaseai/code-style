# Passion Factory Code Style Rules — C#

C# rules for `@pleaseai/code-style`, condensed from the Google C# Style Guide.
The guide names no formatter or linter, so match the project's existing
`.editorconfig` and analyzers. Read it together with `general.md` in this
directory.

## Naming

- `PascalCase` for classes, methods, properties, constants, namespaces, and
  public fields.
- `_camelCase` (leading underscore) for private, internal, and protected fields.
- `camelCase` for locals and parameters.
- Prefix interfaces with `I` (`IMyInterface`). Prefix type parameters with `T`
  (`TKey`, `TValue`), or use a bare `T` for simple cases.

## Formatting

- Indent 2 spaces, never tabs. Wrap at 100 columns. One statement per line.
- Use K&R braces: no line break before `{`, `} else {` on one line. Braces are
  required even when optional.
- Put `using` directives at the top of the file, outside namespaces, with
  `System` first and the rest alphabetical.
- Write modifiers in this order: `public protected internal private new
  abstract virtual override sealed static readonly extern unsafe volatile
  async`.
- Always write access modifiers explicitly.

## Declaration Order

- Order class members as nested types, enums, delegates, and events; static,
  `const`, and `readonly` fields; fields and properties; constructors and
  finalizers; methods.
- Within each group, order by accessibility: public, internal, protected
  internal, protected, private. Keep interface implementations together.

## Language Features

- Use `var` when the type is obvious from the right-hand side or too noisy to
  spell out; use an explicit type when it clarifies, and always for basic types.
- Use expression-bodied members sparingly, for simple properties and lambdas;
  give methods block bodies.
- Use string interpolation where it reads best. For many concatenations in a
  loop or hot path, use `StringBuilder`.
- Use collection and object initializers, `?.` and `??` for null checks, and
  pattern matching (`obj is string str`) for type tests and casts.
- Use LINQ for readability, but watch its cost in hot paths.
- Make a field or local `const` when its value is a compile-time constant.
  Otherwise make a field `readonly` when it is assigned only at declaration or
  in a constructor. Use a named constant instead of a magic number.

## Design

- Use a class almost always; use a struct only for small, short-lived,
  value-like types.
- Accept the most restrictive collection type (`IEnumerable<T>`,
  `IReadOnlyList<T>`) for inputs that are not modified. Return `IList<T>` only
  to hand over ownership of a mutable list.
- Prefer `List<T>` to arrays for public members, and use arrays for fixed-size
  or multidimensional data.
- Write extension methods only when the source type cannot be changed, and only
  for broadly useful behavior.
- Put `out` parameters last; prefer a tuple or return type when it is clearer.
- Make unclear arguments clear: use named constants, an `enum` instead of a
  `bool`, named arguments, or an options object.

## File Organisation

- Keep one class, interface, enum, or struct per file, and name the file after
  its primary type.
- Keep the folder layout flat and consistent with the project; do not force it to
  mirror namespaces.
- Keep namespaces to two levels or fewer. Use them for shared library code; leaf
  application code does not need them. A new top-level namespace must be globally
  unique and recognizable.

## Sources

- [Google C# Style Guide](https://google.github.io/styleguide/csharp-style.html)
- [Conductor C# summary](https://github.com/gemini-cli-extensions/conductor/blob/main/skills/conductor-setup/assets/code_styleguides/csharp.md)

See `NOTICE.md` for licenses.
