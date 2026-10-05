# `rust-error-outside-error-file`

| | |
| --- | --- |
| Slug | `code-error-types-in-dedicated-module` |
| Language | Rust (`.rs`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

`error.rs` is the established place for a crate's (or module's) error types.
When every error type lives there, an agent that needs to return, match, or
convert an error opens one file instead of searching the crate, and existing
error variants are extended instead of duplicated.

## What the rule matches

ast-grep has no type information, so the rule matches any of:

- a `struct` or `enum` whose name ends in `Error` (including `enum Error`);
- a `struct` or `enum` with a derive that names `Error`
  (`#[derive(Debug, thiserror::Error)]`);
- `impl std::error::Error for T` (also `impl Error for T`,
  `impl core::error::Error for T`).

## Wrong

```rust
// src/parser.rs
#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("unexpected token at {0}")]
    UnexpectedToken(usize),
}

pub fn parse(input: &str) -> Result<Ast, ParseError> { /* … */ }
```

## Right

```rust
// src/error.rs
#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("unexpected token at {0}")]
    UnexpectedToken(usize),
}
```

```rust
// src/parser.rs
use crate::error::ParseError;

pub fn parse(input: &str) -> Result<Ast, ParseError> { /* … */ }
```

```rust
// src/lib.rs
mod error;
mod parser;

pub use crate::error::ParseError;
```

## How to fix

1. Open `error.rs` next to the module root (`src/error.rs` for the crate, or
   `src/<module>/error.rs` for a large module); create it and add `mod error;`
   to the parent (`lib.rs`, `main.rs`, or `<module>.rs`) if it does not exist.
2. Move the type together with its `impl Display`, `impl Error`, and `From`
   impls into `error.rs`.
3. Import it where it is used, by the path of its `error` module:
   `use crate::error::ParseError;` for the crate's `src/error.rs`, or
   `use crate::<module>::error::ParseError;` for `src/<module>/error.rs`. If it
   is part of the public API, re-export it by name from the module that
   exposed it before (`pub use crate::error::ParseError;`, or
   `pub use self::error::ParseError;` inside `<module>`) — not with a glob
   (see `rust-no-glob-reexport`).
4. Run `cargo check --all-targets`.

## Exempt files

`error.rs`, files under an `error/` module directory, and integration tests
under `tests/` are ignored.
