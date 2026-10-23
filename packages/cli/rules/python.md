# Passion Factory Code Style Rules — Python

Python rules for `@pleaseai/code-style`, condensed from the Google Python Style
Guide. The guide names `pylint` as its linter. Read it together with
`general.md` in this directory.

## Language Rules

- Run `pylint` and fix what it reports.
- Use `import x` for packages and modules; use `from x import y` only when `y`
  is a submodule. Put each import on its own line and group them: standard
  library, third party, then your own application.
- Raise built-in exception classes where they fit. Never write a bare
  `except:`.
- Avoid mutable global state. Module-level constants are fine and are written
  `ALL_CAPS_WITH_UNDERSCORES`.
- Use comprehensions for simple cases and a full loop when the logic is
  complex.
- Never use a mutable object (`[]`, `{}`) as a default argument value.
- Rely on implicit falsiness (`if not items:`), and test `None` with
  `is None` / `is not None`.
- Annotate the types of public APIs.

## Formatting

- Indent 4 spaces, never tabs. Wrap at 80 characters.
- Put two blank lines between top-level definitions and one between methods.
- Avoid extra whitespace; surround binary operators with single spaces.
- Use f-strings for formatting, and keep one quote style within a file.
- Write TODOs as `TODO(username): description`.

## Docstrings

- Give every public module, function, class, and method a docstring in
  `"""triple double quotes"""`.
- Start with a one-line summary, then add `Args:`, `Returns:` (or `Yields:`),
  and `Raises:` sections as they apply.

## Naming

- Modules, functions, methods, variables: `snake_case`.
- Classes: `PascalCase`.
- Constants: `ALL_CAPS_WITH_UNDERSCORES`.
- Mark module- or class-internal names with a single leading underscore.

## Entry Points

- Put an executable file's logic in `main()` and call it under
  `if __name__ == '__main__':`.

## Sources

- [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
- [Conductor Python summary](https://github.com/gemini-cli-extensions/conductor/blob/main/skills/conductor-setup/assets/code_styleguides/python.md)

See `NOTICE.md` for licenses.
