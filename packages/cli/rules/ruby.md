# Passion Factory Code Style Rules — Ruby

Ruby rules for `@pleaseai/code-style`, condensed from the community Ruby Style
Guide. `rubocop` enforces it. Read it together with `general.md` in this
directory.

## Language Rules

- Prefer blocks and iterators (`each`, `map`, `select`, `reduce`) to `for` and
  `while` loops.
- Start each file with `# frozen_string_literal: true`.
- Rely on the implicit return of the last expression. Use `return` only for
  early-exit guard clauses (`return if record.nil?`).
- Never rescue bare `Exception` and never leave a `rescue` block empty. Rescue
  specific errors (`StandardError` at the widest) and report what failed.
- Use keyword arguments for methods that take boolean flags or several
  parameters.
- Use safe navigation (`&.`) and `||=` / `&&=` where they read clearly, without
  hiding nil values that signal a bug.

## Formatting

- Indent 2 spaces, never tabs. Keep lines to about 80–100 characters.
- Use double quotes when interpolating or escaping; otherwise follow the
  project's quoting style. Never use typographic quotes.
- Omit parentheses for methods without arguments and for DSL-style calls such as
  `puts`, `render`, `validates`, and `belongs_to`; keep them on ordinary calls
  with arguments.
- Document public APIs with YARD or RDoc comments.

## Naming

- `snake_case` for methods, variables, files, and directories.
- `CamelCase` for classes and modules; `SCREAMING_SNAKE_CASE` for constants.
- A method that returns a boolean ends in `?` (`valid?`, `empty?`).
- A method with a dangerous or in-place counterpart ends in `!` (`save!`,
  `sort!`).

## Sources

- [Ruby Style Guide](https://rubystyle.guide)
- [Conductor Ruby summary](https://github.com/gemini-cli-extensions/conductor/blob/main/skills/conductor-setup/assets/code_styleguides/ruby.md)

See `NOTICE.md` for licenses.
