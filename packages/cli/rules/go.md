# Passion Factory Code Style Rules — Go

Go rules for `@pleaseai/code-style`, condensed from Effective Go. `gofmt`
(`go fmt`) is the authority on layout. Read it together with `general.md` in
this directory.

## Formatting

- Format every file with `gofmt`. It uses tabs for indentation and decides line
  wrapping; there is no line-length limit.
- Do not hand-format around `gofmt`; change the code, not the tool output.

## Naming

- Write multi-word names in `MixedCaps` or `mixedCaps`; never use underscores.
- A leading uppercase letter exports a name. Keep names unexported unless
  other packages need them.
- Package names are short, lowercase, and a single word.
- A getter for a field `owner` is `Owner()`, not `GetOwner()`; the setter is
  `SetOwner()`.
- Name a one-method interface after the method plus `-er` (`Reader`, `Writer`).

## Control Flow

- Write `if`, `for`, and `switch` without parentheses around the condition;
  braces are always required.
- Put setup in the `if` header when the variable is only needed there:
  `if err := f.Chmod(0o664); err != nil { … }`.
- Use `for … range` for slices, maps, strings, and channels.
- `switch` cases do not fall through; use `fallthrough` only when you mean it.
  A `switch` with no expression replaces a long `if` / `else if` chain.

## Functions and Data

- Return `(value, err)` for operations that can fail, with the error last.
- Use named results when they document the return values, not by habit.
- Release resources with `defer` right after acquiring them.
- Use `new(T)` for a zeroed pointer and `make` only for slices, maps, and
  channels.
- Prefer slices to arrays. Test map membership with `v, ok := m[key]`.

## Interfaces and Concurrency

- Types satisfy interfaces implicitly; prefer many small interfaces to one
  large one.
- Share memory by communicating: pass data between goroutines on channels
  instead of guarding shared state.

## Errors

- Check every returned error. Do not discard one with `_` unless you can say why
  it is safe to ignore.
- Reserve `panic` for unrecoverable situations; libraries should return errors
  instead of panicking.

## Sources

- [Effective Go](https://go.dev/doc/effective_go)
- [Conductor Go summary](https://github.com/gemini-cli-extensions/conductor/blob/main/skills/conductor-setup/assets/code_styleguides/go.md)

See `NOTICE.md` for licenses.
