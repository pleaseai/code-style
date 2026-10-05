# `rust-no-glob-reexport`

| | |
| --- | --- |
| Slug | `code-greppable-public-symbols` |
| Language | Rust (`.rs`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

`pub use path::*;` re-exports every public item of `path` without naming any of
them. Searching the crate for a re-exported name finds its definition but not
the line that makes it public here, and the module's API changes silently when
`path` gains or loses an item. An explicit list names every exported item, so
one search finds where it is defined and where it is re-exported.

clippy does not cover this: `clippy::wildcard_imports` skips `pub use`
re-exports unless `warn-on-all-wildcard-imports = true` is set, and that
setting also flags private globs such as `use super::*;` in test modules.

## What the rule matches

Any `use` declaration with a visibility modifier (`pub`, `pub(crate)`,
`pub(super)`) that contains a `*` anywhere in its tree. Private glob imports
(`use super::*;`, `use std::collections::*;`) are not matched.

## Wrong

```rust
// src/lib.rs
mod model;

pub use crate::model::*;
```

## Right

```rust
// src/lib.rs
mod model;

pub use crate::model::{Account, User};
```

## How to fix

1. List the public items of the glob's target module (`cargo doc --open`, or
   read the module's `pub` items).
2. Replace `*` with a braced list of every item the glob exports today:
   `pub use crate::model::{Account, User};`. Leave an item out only when
   removing it from the public API is intentional — downstream crates may use
   it.
3. Run `cargo check --all-targets`. Any "unresolved import" or "cannot find"
   error names an item that was reached through the glob; add it to the list.
   This only covers this crate's own targets, not downstream callers.
4. For a nested glob (`pub use a::{B, c::*};`), expand only the `*` part.
