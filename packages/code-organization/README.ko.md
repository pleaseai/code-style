# @pleaseai/code-organization

[English](./README.md) | 한국어

코딩 에이전트가 코드베이스를 쉽게 탐색하도록 돕는 규칙 모음입니다. 공개 심볼은
이름으로 찾을 수 있고, 파일 이름은 그 파일이 노출하는 심볼을 따르며, 테스트는
소스 경로에서 위치를 유도할 수 있어야 합니다. 이 패키지는 TypeScript, Dart,
Kotlin, Java, Rust에 대해
[ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md)를
집행합니다.

모든 규칙은 **경고(warning)**로 배포됩니다. `--strict`를 쓰거나 직접 규칙의
심각도를 올리지 않는 한 빌드를 막지 않습니다.

## 설치

```sh
bun add -D @pleaseai/code-organization
```

`bunx @pleaseai/code-style init`에서 **code-organization**을 선택하면 설치와
`sgconfig.yml` 작성까지 해 줍니다. `ast-grep` 바이너리는 의존성인
[`@ast-grep/cli`](https://ast-grep.github.io/)가 제공합니다.

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

검사는 두 층으로 나뉩니다. 2층은 ast-grep 규칙이고, 3층은 ast-grep이 보지
못하는 것(파일 이름, 테스트 경로, 헬퍼 공유 여부)을 맡는 경로 검사기입니다.

## 2층: ast-grep 규칙

프로젝트의 `sgconfig.yml`이 규칙 디렉터리를 가리키게 합니다.

```yaml
# sgconfig.yml
ruleDirs:
  - node_modules/@pleaseai/code-organization/rules
```

```sh
bunx ast-grep scan
```

설정 파일을 따로 두지 않고 패키지의 설정을 바로 쓸 수도 있습니다.

```sh
bunx ast-grep scan -c node_modules/@pleaseai/code-organization/sgconfig.yml
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

프레임워크가 형태를 정하는 파일(설정 파일, Nuxt `pages/`·`layouts/`, Nitro
`server/api/`, Storybook story 등)은 각 규칙의 `ignores` 목록으로 제외합니다.

## 3층: 경로 검사기

```sh
bunx please-code-org check            # 현재 디렉터리 검사
bunx please-code-org check packages/  # 하위 디렉터리 검사
bunx please-code-org check --json     # 기계가 읽는 출력
bunx please-code-org check --strict   # 발견 사항이 하나라도 있으면 exit 1
```

| 종료 코드 | 의미 |
| --- | --- |
| `0` | 발견 사항 없음, 또는 경고만 있음(기본) |
| `1` | `--strict`에서 발견 사항 있음 |
| `2` | 사용법 오류 또는 설정 오류 |

검사 내용은 다음과 같습니다.

- **`code-filename-matches-primary-symbol`**(TypeScript, Dart): 공개 심볼이
  정확히 하나인 파일은 그 이름을 따라야 합니다. TypeScript는 kebab-case,
  Dart는 snake_case로 비교합니다. `errors.ts`/`errors.dart`, `index.ts`, 설정
  파일, 테스트 파일, `part of` 파일, Dart 생성 파일은 제외합니다. Kotlin과
  Java는 ktlint `standard:filename`과 javac가 맡습니다.
- **`test-path-derivable-from-source`**:
  - TypeScript: `src/foo/bar.ts` ↔ `test/foo/bar.test.ts`(`tests/`,
    `.spec.ts`도 허용). 소스 루트가 하나면 루트 이름을 빼고, 여럿이면(Nuxt 4의
    `app/`, `server/`, `shared/`) 남깁니다. 예:
    `server/utils/db.ts` ↔ `test/unit/server/utils/db.test.ts`.
  - Dart: `lib/a/b.dart` ↔ `test/a/b_test.dart`.
  - Kotlin/Java: `src/main/kotlin/…/Foo.kt` ↔ `src/test/kotlin/…/FooTest.kt`
    (`java`도 같음).
  - 테스트 루트 바로 아래의 환경 구간은 닫힌 목록 `unit`, `nuxt`, `browser`,
    `e2e`에 있을 때만 인정합니다. 첫 구간이 목록에 있으면 환경 구간으로도,
    미러 경로의 일부로도 해석해 봅니다. `e2e/` 아래 테스트는 경로를 유도하지
    않습니다.
  - 보고 대상은 대상 소스가 없는 테스트(고아 테스트)와 테스트 루트 밖의 테스트
    파일입니다. 테스트가 없는 소스는 보고하지 않습니다.
  - Rust: 통합 테스트는 Cargo가 찾는 위치에 있어야 합니다.
    `cargo metadata --no-deps --format-version 1`을 읽고 `mod` 선언을 따라가,
    Cargo가 컴파일하지 않는 `tests/**/*.rs` 파일(`tests/common/`과
    `tests/<name>/main.rs` 대상의 하위 모듈은 제외)과 어떤 `mod` 선언도 닿지
    않는 `#[test]` 파일을 보고합니다. `cargo`가 없으면 알림을 남기고 Rust를
    건너뜁니다.
- **`test-helpers-in-dedicated-location`**: 지정 위치 밖에서 선언된 헬퍼
  후보(`mock*`, `createMock*`, `fake*`, `stub*`)는 둘 이상의 테스트 파일이
  import할 때만 보고합니다. 지정 위치는 `<테스트 루트>/test-utils/`(TypeScript),
  `test/helpers/`(Dart), `src/testFixtures/`(Kotlin/Java Gradle test fixtures),
  `tests/common/`(Rust, `common` 밖 모듈을 둘 이상의 test 대상이 불러오면 보고)
  입니다.

### 설정

검사하는 디렉터리(또는 패키지 디렉터리, 루트 설정에 더해짐)에 선택적으로
`code-organization.json`을 둘 수 있습니다. 설정은 이름을 **추가**만 할 수
있습니다. 테스트를 소스 옆에 두거나 검사를 끄는 옵션은 없습니다.

```json
{
  "sourceRoots": ["lib"],
  "envSegments": ["integration"]
}
```

| 키 | 효과 |
| --- | --- |
| `sourceRoots` | TypeScript 소스 루트 추가. 예: `srcDir`를 바꾼 Nuxt 프로젝트. 루트를 추가하면 루트가 여럿이 되므로 테스트 경로에 루트 이름이 남습니다. |
| `envSegments` | 테스트 루트 바로 아래에 둘 수 있는 환경 구간 이름 추가. |

다른 위치의 설정 파일은 `--config <file>`로 지정합니다.

### 코드에서 사용

```ts
import { checkCodeOrganization } from '@pleaseai/code-organization'

const { findings, notices } = checkCodeOrganization({ root: process.cwd() })
```

옵션의 `cargoMetadata`로 `cargo metadata` 호출을 대체할 수 있습니다(cargo가
없는 환경용).

## 테스트를 옮길 때

`test-path-derivable-from-source`에 맞춰 테스트를 옮겼다면 옮기기 전후에 테스트
러너가 찾은 테스트 목록을 비교하세요(`vitest list`, `cargo test -- --list`).
러너는 테스트를 찾지 못해도 성공으로 끝나므로 종료 코드만으로는 빠진 테스트를
잡지 못합니다.

## 라이선스

MIT
