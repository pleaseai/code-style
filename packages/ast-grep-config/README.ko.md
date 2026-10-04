# @pleaseai/ast-grep-config

[English](./README.md) | 한국어

코딩 에이전트가 코드베이스를 쉽게 탐색하도록 돕는
[ast-grep](https://ast-grep.github.io/) 규칙 모음입니다. 공개 심볼은 이름으로
찾을 수 있어야 하고, 에러 타입은 지정된 파일에 모으며, 소스 파일 안에 테스트를
두지 않습니다. 이 패키지는 TypeScript, Dart, Kotlin, Java, Rust에 대해
[ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md)의
2층(구조 규칙)을 집행합니다. 3층 경로 검사기(파일 이름, 테스트 경로, 공유 테스트
헬퍼)는 `@pleaseai/code-style`의
[`please-style check`](../cli/README.ko.md#please-style-check)이며, 이 패키지의
`extract/` 규칙을 사용합니다.

모든 규칙은 **경고(warning)**로 배포됩니다. 직접 규칙의 심각도를 올리지 않는 한
빌드를 막지 않습니다.

## 설치

```sh
bun add -D @pleaseai/ast-grep-config @ast-grep/cli
```

`bunx @pleaseai/code-style init`에서 **ast-grep**을 선택하면 설치와
`sgconfig.yml` 작성까지 해 줍니다. `ast-grep` 바이너리는 peer dependency인
[`@ast-grep/cli`](https://ast-grep.github.io/)가 제공하므로, 프로젝트의 bin
경로에 `ast-grep`이 잡히도록 이 패키지와 함께 설치하세요.

bun을 쓴다면 `package.json`에 `"trustedDependencies": ["@ast-grep/cli"]`를
추가해 postinstall 단계가 실행되게 하세요. 그렇지 않으면 `ast-grep`을 실행할
때마다 대체 경로 경고가 출력됩니다(경로 검사기는 영향을 받지 않습니다).

## 다섯 가지 원칙

| Slug | 원칙 |
| --- | --- |
| `code-greppable-public-symbols` | 공개 심볼은 이름 있는 선언으로 정의하고 노출해, 이름 검색 한 번으로 정의와 사용처를 모두 찾는다. |
| `code-filename-matches-primary-symbol` | 공개 심볼이 하나인 파일은 언어의 파일 이름 규약으로 정규화했을 때 그 심볼 이름과 일치한다. |
| `code-error-types-in-dedicated-module` | 모듈의 에러 타입은 지정된 에러 파일이나 패키지에 모은다. |
| `test-path-derivable-from-source` | 테스트는 툴체인이 정한 테스트 루트 아래, 대상 소스 경로를 미러링한 위치에 둔다. |
| `test-helpers-in-dedicated-location` | 여러 테스트가 공유하는 헬퍼는 지정된 위치에 둔다. |

검사는 두 층으로 나뉩니다. 2층은 이 패키지의 ast-grep 규칙이고, 3층은
ast-grep이 보지 못하는 것(파일 이름, 테스트 경로, 헬퍼 공유 여부)을 맡는 경로
검사기 `please-style check`입니다.

## 규칙

프로젝트의 `sgconfig.yml`이 규칙 디렉터리를 가리키게 합니다.

```yaml
# sgconfig.yml
ruleDirs:
  - node_modules/@pleaseai/ast-grep-config/rules
```

```sh
bunx ast-grep scan
```

설정 파일을 따로 두지 않고 패키지의 설정을 바로 쓸 수도 있습니다.

```sh
bunx ast-grep scan -c node_modules/@pleaseai/ast-grep-config/sgconfig.yml
```

| 규칙 | Slug | 언어 |
| --- | --- | --- |
| [`ts-no-default-export`](./rules/typescript/ts-no-default-export.md) | `code-greppable-public-symbols` | TypeScript |
| [`tsx-no-default-export`](./rules/tsx/tsx-no-default-export.md) | `code-greppable-public-symbols` | TSX |
| [`rust-no-glob-reexport`](./rules/rust/rust-no-glob-reexport.md) | `code-greppable-public-symbols` | Rust |
| [`ts-error-outside-errors-file`](./rules/typescript/ts-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | TypeScript |
| [`tsx-error-outside-errors-file`](./rules/tsx/tsx-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | TSX |
| [`dart-error-outside-errors-file`](./rules/dart/dart-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | Dart |
| [`kotlin-error-outside-errors-file`](./rules/kotlin/kotlin-error-outside-errors-file.md) | `code-error-types-in-dedicated-module` | Kotlin |
| [`java-error-outside-error-package`](./rules/java/java-error-outside-error-package.md) | `code-error-types-in-dedicated-module` | Java |
| [`rust-error-outside-error-file`](./rules/rust/rust-error-outside-error-file.md) | `code-error-types-in-dedicated-module` | Rust |
| [`ts-no-in-source-test`](./rules/typescript/ts-no-in-source-test.md) | `test-path-derivable-from-source` | TypeScript |
| [`tsx-no-in-source-test`](./rules/tsx/tsx-no-in-source-test.md) | `test-path-derivable-from-source` | TSX |

규칙마다 옆에 README가 있고, 규칙의 이유, 틀린 예와 올바른 예, 위반을 고치는
단계를 적어 두었습니다(영문). 경고 메시지에 slug와 README 경로가 들어 있어
에이전트가 메시지만 보고도 위반을 고칠 수 있습니다.

프레임워크가 형태를 정하는 파일(설정 파일, Nuxt 4 `app/pages/`·`app/layouts/`,
Nitro `server/api/`, Storybook story 등)은 각 규칙의 `ignores` 목록으로
제외합니다. `app/` 없이 루트에 `pages/`를 두는 Nuxt 3 구조는 제외하지 않습니다.
이 경우 규칙 범위를 좁히는 방법은
[`ts-no-default-export` README](./rules/typescript/ts-no-default-export.md#nuxt-3-layouts-no-app-directory)를
참고하세요.

`extract/`에는 `please-style check`이 실행하는 추출 규칙이 있습니다.
`ruleDirs`에 들어 있지 않으므로 `ast-grep scan` 출력에는 나타나지 않습니다.

## 라이선스

MIT
