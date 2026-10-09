# @pleaseai/code-style

[English](./README.md) | 한국어

PleaseAI의 공유 코드 스타일을 어떤 프로젝트에도 적용해 주는 CLI입니다 —
eslint/prettier/editorconfig/ast-grep 패키지를 설치하고, AI 코딩 어시스턴트가
처음부터 린트를 통과하는 코드를 작성할 수 있도록 `AGENTS.md`의 규칙 블록을
관리합니다. `please-style check`로 파일 이름과 테스트 경로를 검사합니다.

[ultracite](https://github.com/haydenbleasel/ultracite)와 네이버페이의
[`@naverpay/code-style-cli`](https://github.com/NaverPayDev/code-style)에서 영감을 받았습니다.

## 사용법

`package.json`이 있는 프로젝트 루트에서 실행하세요:

```bash
bunx @pleaseai/code-style         # `init`과 동일
bunx @pleaseai/code-style init    # 대화형 설정
bunx @pleaseai/code-style update  # AGENTS.md 규칙 블록만 다시 적용
bunx @pleaseai/code-style doctor  # 현재 프로젝트 상태 확인
bunx @pleaseai/code-style check   # 파일 이름과 테스트 경로 검사 (ADR-0022)
```

`npx`, `pnpm dlx`, `yarn dlx`에서도 동일하게 동작합니다.

## 동작 방식

`init` 명령은 다음을 수행합니다:

1. 패키지 매니저를 자동 감지합니다 (lockfile 기준으로 bun → pnpm → yarn → npm).
2. PleaseAI 코드 스타일 도구 목록을 체크박스 UI로 표시합니다. 이미 설치된
   항목은 `(installed)` / `(설치됨)`으로 표시됩니다.
3. 선택한 패키지를 dev dependency로 설치합니다.
4. 해당 설정 파일을 작성하거나 업데이트합니다.

### 지원 도구

| 도구 | npm 패키지 | 설정 파일 |
| --- | --- | --- |
| eslint-config | `@pleaseai/eslint-config`, `eslint` | `eslint.config.mjs` |
| prettier-config | `@pleaseai/prettier-config`, `prettier` | `package.json#prettier` |
| editorconfig | `@pleaseai/editorconfig` | `.editorconfig` (`node_modules`에서 복사) |
| agents-md | — | `AGENTS.md` (마커로 관리되는 블록) |
| ast-grep | `@pleaseai/ast-grep-config`, `@ast-grep/cli` | `sgconfig.yml` |

## ast-grep 규칙

**ast-grep**을 선택하면 [`@pleaseai/ast-grep-config`](../ast-grep-config)와
`@ast-grep/cli`를 설치하고, ast-grep이 그 규칙을 쓰도록 `sgconfig.yml`을
작성합니다. 프로젝트는 아래 두 명령으로 검사하며, 둘 다 기본으로는 경고만
합니다.

```bash
bunx ast-grep scan                    # default export, 에러 파일 위치, in-source 테스트 등
bunx @pleaseai/code-style check       # 파일 이름, 테스트 경로, 공유 테스트 헬퍼
bunx @pleaseai/code-style check --strict   # 발견 사항이 있으면 exit 1 (위반을 없앤 뒤 CI용)
```

`ast-grep scan`의 모든 경고는 규칙의 slug와 수정 방법을 적은 README 경로를
함께 보여 줍니다. 구조 규칙은
[`@pleaseai/ast-grep-config` README](../ast-grep-config/README.ko.md)를
참고하세요. `please-style check`의 발견 사항은 slug를 보여 주며, 각 검사는
[`please-style check`](#please-style-check)에 설명되어 있습니다.

## `please-style check`

`check`는
[ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md)의
3층 경로 검사기로, ast-grep이 보지 못하는 것(파일 이름, 테스트 경로, 헬퍼 공유
여부)을 맡습니다. [`@pleaseai/ast-grep-config`](../ast-grep-config)에 들어 있는
추출 규칙을 `@ast-grep/cli`의 `ast-grep` 바이너리로 실행합니다. 추출 규칙은
`check` 내부 구현이라 이 CLI의 코드와 맞아야 하므로, CLI가 일반 의존성으로 가진
`@pleaseai/ast-grep-config`에서 가져옵니다. 검사하는 프로젝트의 사본은 CLI 쪽을
찾지 못할 때만 씁니다(프로젝트의 사본은 `sgconfig.yml`이 가리키는 lint
`rules/`를 위한 것입니다). 바이너리는 검사하는 프로젝트에서 먼저 찾으므로
프로젝트가 고정한 ast-grep 버전이 우선하고, 없으면 CLI 자신의 설치에서 찾습니다.
`@ast-grep/cli`는 이 패키지의 선택적 peer dependency이므로 프로젝트에
설치하세요. `init`의 **ast-grep** 도구가 설치해 줍니다.

```bash
bun add -D @pleaseai/ast-grep-config @ast-grep/cli
```

```bash
bunx @pleaseai/code-style check            # 현재 디렉터리 검사
bunx @pleaseai/code-style check packages/  # 하위 디렉터리 검사
bunx @pleaseai/code-style check --json     # 기계가 읽는 출력
bunx @pleaseai/code-style check --strict   # 발견 사항이 하나라도 있으면 exit 1
```

| 플래그 | 설명 |
| --- | --- |
| `[path]` | 검사할 디렉터리 (기본값: 현재 디렉터리) |
| `--json` | 결과를 JSON(`root`, `findings`, `notices`)으로 출력 |
| `--strict` | 발견 사항이 하나라도 있으면 exit 1 (기본: 경고만) |
| `--config <file>` | 설정 파일 (기본값: 둘러싼 프로젝트 루트의 `code-organization.json`, 위쪽에 프로젝트 표지 파일이 없으면 `<path>`의 것) |
| `--help`, `-h` | `check` 사용법 출력 |

| 종료 코드 | 의미 |
| --- | --- |
| `0` | 발견 사항 없음, 또는 경고만 있음(기본) |
| `1` | `--strict`에서 발견 사항 있음 |
| `2` | 사용법 오류, 설정 오류, 또는 추출이 필요한 파일이 있는데 `@ast-grep/cli`를 찾지 못함 (맞는 소스가 없는 트리는 추출이 필요 없음) |

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

둘러싼 프로젝트 루트(`[path]`의 스캔 루트, 위쪽에 프로젝트 표지 파일이 없으면
검사하는 디렉터리 자체) 또는 패키지 디렉터리(루트 설정에 더해짐)에 선택적으로
`code-organization.json`을 둘 수 있습니다. 설정은 이름을 **추가**만 할 수
있습니다. 하위 디렉터리를 검사할 때는 그 경로에 걸친 패키지(그 디렉터리를
감싸거나 그 안에 있는 패키지)의 설정만 읽으므로, 관계없는 형제 패키지의 설정이
깨져 있어도 검사가 실패하지 않습니다. 테스트를 소스 옆에 두거나 검사를 끄는
옵션은 없습니다.

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

### 테스트를 옮길 때

`test-path-derivable-from-source`에 맞춰 테스트를 옮겼다면 옮기기 전후에 테스트
러너가 찾은 테스트 목록을 비교하세요(`vitest list`, `cargo test -- --list`).
러너는 테스트를 찾지 못해도 성공으로 끝나므로 종료 코드만으로는 빠진 테스트를
잡지 못합니다.

## `AGENTS.md` 블록

CLI는 아래 마커 사이의 내용만 관리합니다 — `AGENTS.md`의 나머지 내용은
사용자의 것이며 그대로 보존됩니다:

```md
<!-- pleaseai-code-style:start -->
...관리되는 내용...
<!-- pleaseai-code-style:end -->
```

`@pleaseai/code-style`을 업그레이드한 뒤에는 `pleaseai-code-style update`를
다시 실행하면 이 블록만 새로고침할 수 있습니다. 전체 규칙 목록은 참고용으로
`node_modules/@pleaseai/code-style/rules.md`로 함께 배포됩니다.

## 옵션

| 플래그 | 설명 |
| --- | --- |
| `--yes`, `-y` | 기본값을 수락하고 기존 파일을 확인 없이 덮어씀 |
| `--lang <ko\|en>` | CLI 언어 강제 지정 (기본값은 `$LANG`) |
| `--help`, `-h` | 도움말 출력 |
| `--version`, `-v` | 버전 출력 |

## 현지화

CLI는 `LC_ALL` / `LANG` / `LC_MESSAGES`에서 locale을 자동 감지하며, 현재 한국어와
영어 메시지를 제공합니다. `--lang ko` 또는 `--lang en`으로 강제 지정할 수 있습니다.

## 라이선스

MIT
