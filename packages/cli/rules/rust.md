# Passion Factory Code Style Rules — Rust

Rust rules for `@pleaseai/code-style`, condensed from the Google Rust Style
Guide with the Chromium, Android, and Fuchsia parts removed. `rustfmt` sets the
layout and `clippy` checks the rest; also follow the official Rust Style Guide
and Rust API Guidelines. Read it together with `general.md` in this directory.

## Modules and Imports

- Name a leaf module and its file after the primary item it defines (`mod foo`
  in `foo.rs` for `Foo`).
- Keep non-leaf modules to `mod` declarations and re-exports; put definitions in
  leaf modules. A small amount of core wiring code is fine.
- Do not use glob re-exports. `pub use path::*;` (also `pub(crate)` and
  `pub(super)`) is flagged by the `rust-no-glob-reexport` ast-grep rule: list
  the items (`pub use crate::model::{Account, User};`). Google's guide allows
  `pub use submodule::*` in non-leaf modules; Passion Factory does not.
- Private globs are allowed for `use super::*;` in test modules and for enum
  variants inside functions that mostly deal with that enum. Do not define
  preludes.
- One `use` statement imports from one module: write `use foo::Foo;` and
  `use foo::bar::{Bar, Baz};`, not `use foo::{Foo, bar::Bar};`.
- Import traits inside the function that needs them unless the file uses them
  throughout.
- Call free functions through their module (`mem::swap(...)`) and import types
  directly (`use regex::Regex;`). Rename or qualify a type only to resolve a
  name clash such as `io::Error`.

## Errors

- Put error types in `error.rs` at the module root (`src/error.rs` or
  `src/<module>/error.rs`) together with their `Display`, `Error`, and `From`
  impls. The `rust-error-outside-error-file` ast-grep rule flags any `struct` or
  `enum` named `*Error`, deriving `Error`, or implementing `std::error::Error`
  elsewhere. Files in an `error/` directory and `tests/` are exempt.
- Choose the failure channel by who can act on it: `Option` when the cause is
  obvious (overflow, missing value), `Result` for recoverable failures the
  caller must tell apart (I/O), `panic!` for bugs and violated invariants.
- Make error types `Copy` when their fields allow it.
- Prefer pattern matching to check-then-`unwrap`
  (`if let Some(v) = opt`, not `if opt.is_some() { opt.unwrap() }`). When a
  panic is needed, use `expect` with the reason.
- Give `assert!` a message that explains why the condition should hold or what
  the caller did wrong; do not just restate the condition.
- Do not call `panic::catch_unwind`, and never reach into a poisoned mutex.

## Ownership and Signatures

- Prefer unique ownership and borrowing to `Rc` / `Arc`, and borrowing to
  `.clone()`. Clone when you need an independent copy or the borrow structure
  gets unreasonable.
- Accept the most flexible borrow: `&T` not `&Box<T>`, `&[T]` not `&Vec<T>`,
  `&str` not `&String`, `Option<&T>` not `&Option<T>`.
- In library code, return iterators rather than `Vec` and accept
  `impl IntoIterator` when you only iterate. In application code a `Vec` or
  slice is fine.
- Accept `impl Into<T>` only in library APIs where call-site ergonomics matter.
- Use an `enum` instead of a `bool` parameter when the meaning is not obvious
  at the call site.
- Prefer generics (`T: Trait`, `impl Trait`) to `dyn Trait` in libraries.
- Library API rules are binding; for application code treat them as strong
  advice and favor simplicity over generality.

## Types and Traits

- Use a newtype instead of a type alias when the type has its own meaning, API,
  or risk of being mixed up with another.
- Prefer structs with named fields to tuples; newtypes are the exception.
- Implement standard traits (`FromStr`, `Default`, `From`) instead of ad hoc
  methods, and use `#[derive]` whenever it expresses the implementation.
- Define a trait only for generic bounds, `impl` / `dyn Trait` values, or an
  extension trait. Use an inherent `impl` otherwise. Name extension traits with
  an `Ext` suffix.
- Implement `Default` for option-bag structs, pair `len()` with `is_empty()`,
  and add `new()` / `from_foo()` next to an important `From` impl.
- Mark public enums and public-field structs used across team boundaries
  `#[non_exhaustive]`, and use `#[must_use]` on functions and types whose result
  must not be ignored.

## Naming

- Follow standard library naming: `as_`, `to_`, `into_` prefixes with the
  matching `self` convention; `new()`, `new_with_foo()`, `try_new()` for
  constructors; `foo()`, `foo_mut()`, `set_foo()`, `take_foo()` for accessors.
- Give lifetimes descriptive names, except `'_` and single letters that only
  relate an input to an output.
- Keep generic parameter names short and indicative (`T`, `K`, `V`).
- Do not abbreviate by dropping letters or with acronyms outsiders would not
  know.

## Code

- Declare types on variables where inference is not obvious: calls to `.into()`
  or `.parse()`, and the result of long iterator chains.
- Avoid long combinator chains and `Iterator::for_each`; use a `for` loop when
  it reads better, and never build a chain in a `for` header.
- When matching a `#[non_exhaustive]` enum, list the variants you care about and
  send the rest to `_`.
- Avoid macros and code generation where a function, type, or trait works; try
  `macro_rules!` before proc macros.
- Do not write `unsafe` unless safe code cannot do the job. Wrap it in a safe
  abstraction, add a `SAFETY:` comment, and justify why safe code will not do
  (with benchmarks if the reason is speed).
- Do not use unstable features, and do not run code before `main()`.
- Use `#[rustfmt::skip]` only for deliberate manual alignment or generated code.

## Documentation

- Document public APIs with `///` and modules with `//!`, in Markdown, with
  capitalization and punctuation. Use `//` for implementation comments.
- Say something the code does not: skip comments that repeat the name or explain
  language basics. Always document panic conditions and the invariants of
  `unsafe` functions and traits.

## Testing

- Unit tests live in a `#[cfg(test)] mod tests;` declared from the source
  module; a split-out test file must be reachable that way (or through
  `#[path]`), or its tests never run.
- Integration tests are `tests/<name>.rs` or `tests/<name>/main.rs`; a file
  elsewhere under `tests/` that no test target loads is never compiled.
- Helpers shared by two or more test targets go in `tests/common/`
  (`mod common;`).

## Sources

- [Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html)
- [Rust Style Guide](https://doc.rust-lang.org/nightly/style-guide/) and
  [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)

See `NOTICE.md` for licenses.
