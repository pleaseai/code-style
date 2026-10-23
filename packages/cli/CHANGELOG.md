# Changelog

## [0.1.2](https://github.com/pleaseai/code-style/compare/code-style-v0.1.1...code-style-v0.1.2) (2026-10-23)


### Features

* **cli:** add --locale and deprecate --lang ko|en ([#68](https://github.com/pleaseai/code-style/issues/68)) ([8a7ca6d](https://github.com/pleaseai/code-style/commit/8a7ca6d393fc44b89478285da393a95e6a6bd3a6))
* **cli:** detect project languages and select rule guides with --lang ([#69](https://github.com/pleaseai/code-style/issues/69)) ([b4d3274](https://github.com/pleaseai/code-style/commit/b4d32742f6e304ac548c6ce67257c22b5ce2f993)), closes [#65](https://github.com/pleaseai/code-style/issues/65)
* **cli:** split rules into per-language guides ([#66](https://github.com/pleaseai/code-style/issues/66)) ([147dc0e](https://github.com/pleaseai/code-style/commit/147dc0ed62076361f88f9207de240880de9d9e5b))
* **cli:** title the AGENTS.md block Passion Factory Code Style ([#67](https://github.com/pleaseai/code-style/issues/67)) ([ef4e526](https://github.com/pleaseai/code-style/commit/ef4e52670687b7427c7e42bf5fd4c7192d7eb1a3))
* **cli:** work without package.json and copy rule guides into .agents/code-style ([#70](https://github.com/pleaseai/code-style/issues/70)) ([93e3967](https://github.com/pleaseai/code-style/commit/93e3967a42e43f204e98124dd4bcfbd18de21348)), closes [#65](https://github.com/pleaseai/code-style/issues/65)

## [0.1.1](https://github.com/pleaseai/code-style/compare/code-style-v0.1.0...code-style-v0.1.1) (2026-10-14)


### Bug Fixes

* **cli:** depend on @pleaseai/ast-grep-config with a caret range ([#52](https://github.com/pleaseai/code-style/issues/52)) ([8d24651](https://github.com/pleaseai/code-style/commit/8d24651e16984e224ccce6a3fdbf89035405496e))

## [0.1.0](https://github.com/pleaseai/code-style/compare/code-style-v0.0.3...code-style-v0.1.0) (2026-10-13)


### ⚠ BREAKING CHANGES

* **deps:** @pleaseai/eslint-config now requires eslint ^10.4.0. ESLint 9 is no longer supported.

### Features

* add @pleaseai/ast-grep-config rules and please-style check path checker ([#36](https://github.com/pleaseai/code-style/issues/36)) ([8aadb75](https://github.com/pleaseai/code-style/commit/8aadb75b8aa478688e66834f8c22cd4d5825844e))


### Bug Fixes

* **cli:** close Yarn Plug'n'Play and Kotlin Multiplatform gaps in please-style ([#48](https://github.com/pleaseai/code-style/issues/48)) ([2ef3049](https://github.com/pleaseai/code-style/commit/2ef30497d6908e900625fade8c38640bf581ffdb))
* **cli:** tighten please-style check heuristics deferred from [#36](https://github.com/pleaseai/code-style/issues/36) ([#42](https://github.com/pleaseai/code-style/issues/42)) ([42a5f65](https://github.com/pleaseai/code-style/commit/42a5f6521ee72b608c8198f24af57b6072fe9580)), closes [#37](https://github.com/pleaseai/code-style/issues/37)


### Miscellaneous Chores

* **deps:** update dependencies within semver ranges across workspaces ([#41](https://github.com/pleaseai/code-style/issues/41)) ([1858fcd](https://github.com/pleaseai/code-style/commit/1858fcdd7b0c6112b4638473b521e461ef390ba4))

## [0.0.3](https://github.com/pleaseai/code-style/compare/code-style-v0.0.2...code-style-v0.0.3) (2026-06-01)


### Bug Fixes

* pin dist output extensions so published packages resolve ([#19](https://github.com/pleaseai/code-style/issues/19)) ([116a92b](https://github.com/pleaseai/code-style/commit/116a92b960547b948e4e50c11a7b52d2b25eec83))

## [0.0.2](https://github.com/pleaseai/code-style/compare/code-style-v0.0.1...code-style-v0.0.2) (2026-04-11)


### Features

* **cli:** add @pleaseai/code-style CLI package ([a20d99a](https://github.com/pleaseai/code-style/commit/a20d99a67dd8163529a9f5b259855030cbed4de9))
