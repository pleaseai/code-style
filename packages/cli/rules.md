# Passion Factory Code Style Rules

The rules are split by language. Read `rules/general.md` for the rules that
apply to every language, then the guide for the language you are writing:

- [`rules/general.md`](./rules/general.md) — every language
- [`rules/typescript.md`](./rules/typescript.md) — TypeScript and JavaScript
- [`rules/dart.md`](./rules/dart.md) — Dart and Flutter
- [`rules/rust.md`](./rules/rust.md) — Rust
- [`rules/java.md`](./rules/java.md) — Java
- [`rules/go.md`](./rules/go.md) — Go
- [`rules/python.md`](./rules/python.md) — Python
- [`rules/ruby.md`](./rules/ruby.md) — Ruby
- [`rules/csharp.md`](./rules/csharp.md) — C#
- [`rules/html-css.md`](./rules/html-css.md) — HTML and CSS

`pleaseai-code-style init` and `update` point your `AGENTS.md` block at the
general guide plus the guide of each selected language. Languages are detected
from marker files in the project root, or set with `--lang <list>`; `update`
keeps the languages the existing block links unless `--lang` is given.
