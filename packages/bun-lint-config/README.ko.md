# @pleaseai/bun-lint-config

[English](./README.md) | 한국어

[`@pleaseai/eslint-config`](../eslint-config)의 규칙 가운데
[`bun lint`](https://bun.com/docs/lint)가 네이티브로 실행하는 규칙을
`bunfig.toml`의 `[lint]` 테이블로 제공합니다. 이 패키지는 ESLint 설정에서 생성한
`lint.toml` 파일 하나만 배포하며, 그 안의 내용은 손으로 작성하지 않습니다.

`bun lint`는 아직 Bun canary 빌드에만 있습니다. bunfig.toml에는 `extends`가
없으므로 테이블을 프로젝트의 `bunfig.toml`에 복사해서 씁니다.

## 포함 범위

`lint.toml`은
`pleaseai({ canonicalPluginNames: true, typescript: true, vue: false })`에서
생성합니다. `canonicalPluginNames`는 규칙 이름을 Bun이 실행하는 이름
(`@typescript-eslint/*`, `eslint-plugin-import`의 `import/*`)으로 맞춥니다.
생성기는 다음을 유지합니다.

- Bun에 내장된 규칙: ESLint 코어, `@typescript-eslint`, `unicorn`, `import`,
  `node`(`eslint-plugin-n`)와 그 옵션
- ESLint 설정의 파일 범위: TypeScript 파일, 테스트, 스크립트, `.d.ts`, 설정 파일
  등에 대한 `[[lint.overrides]]`
- 전역 ignore: `ignorePatterns`
- 이름은 다르지만 네이티브 대응 규칙이 있는 규칙: 대응 규칙으로 매핑(아래 참고)

다음은 포함하지 않습니다.

- Bun이 네이티브로 실행하지 않는 플러그인(아래에서 매핑한 규칙 제외):
  stylistic(`style/*`), `regexp`, `jsdoc`, `antfu`, `perfectionist`,
  `unused-imports`, `eslint-comments`, `command`, `e18e`
- `bun lint`가 검사하지 않는 JSON, YAML, TOML, Markdown
- 포매팅. 이 패키지는 `[fmt]`가 아니라 `[lint]`만 설정합니다.

`off` 설정은 Bun에서 기본으로 켜진 규칙이나 앞선 테이블이 켠 규칙을 끄는 경우에만
기록합니다.

`@pleaseai/eslint-config`가 켜지 않는 규칙이라도 Bun이 기본으로 켜는 규칙은
그대로 켜져 있습니다. ESLint 코어 규칙 14개(`no-constant-condition`,
`for-direction`, `no-useless-escape`, `no-unsafe-optional-chaining` 등),
`bun:test`를 import하는 파일의 `bun:test` 규칙, `react`가 의존성에 있을 때의
React 규칙이 그렇습니다. 그래서 `bun lint`는 ESLint보다 조금 더 많이 보고할 수
있습니다.

### 매핑한 규칙

`src/rule-map.ts`는 `bun lint`에 같은 이름의 네이티브 규칙이 없지만 같은 일을 하는
네이티브 규칙이 있는 경우, 그 규칙으로 매핑합니다. 생성기는 심각도, 옵션, 파일 범위를
그대로 두고 네이티브 이름으로 기록합니다.

- antfu의 `test/*`(vitest) 규칙을 `vitest/*`로: `consistent-test-it`,
  `no-identical-title`, `no-import-node-test`, `prefer-hooks-in-order`,
  `prefer-lowercase-title`, 그리고 `no-only-tests`는 `vitest/no-focused-tests`로
- `unused-imports/no-unused-vars`를 `@typescript-eslint/no-unused-vars`로
- `style/jsx-*` 규칙을 `react/jsx-*`로: `closing-bracket-location`,
  `closing-tag-location`, `curly-brace-presence`, `curly-newline`,
  `curly-spacing`, `equals-spacing`, `first-prop-new-line`, `indent-props`,
  `max-props-per-line`, `one-expression-per-line`, `tag-spacing`
- `antfu/no-top-level-await`를 `n/no-top-level-await`로
- `e18e/prefer-array-some`, `prefer-date-now`, `prefer-regex-test`,
  `prefer-object-has-own`을 각각 `unicorn/prefer-array-some`,
  `unicorn/prefer-date-now`, `unicorn/prefer-regexp-test`,
  `prefer-object-has-own`으로

매핑한 규칙이 대상 규칙을 소유합니다. 대상 규칙에 대한 ESLint 설정의 자체 항목은
버리고(예: TypeScript 파일에서 `@typescript-eslint/no-unused-vars`를 끄는 항목),
그 항목 중 `off`가 아닌 것이 있으면 생성기가 실패합니다. `jsx-wrap-multilines`는
Bun이 `propertyValue` 옵션을 거부하므로 매핑하지 않습니다.

매핑한 규칙은 ESLint 규칙과 비슷하지만 똑같지는 않습니다.

- vitest 규칙은 `vitest`에서 import하는 파일에서 동작합니다. `bun:test`를 import하는
  파일에서는 Bun이 자체 `bun:test` 규칙을 실행합니다.
- 보고 위치(열)가 다를 수 있습니다. `no-import-node-test`는 모듈 이름,
  `no-identical-title`은 제목, `prefer-array-some`은 `filter`,
  `prefer-regexp-test`는 정규식을 가리킵니다.
- Bun은 `no-unused-vars`와 `@typescript-eslint/no-unused-vars`를 하나의 규칙으로
  다루고 TypeScript override가 `no-unused-vars`를 끄므로, TypeScript 파일에서는
  사용하지 않는 변수를 보고하지 않습니다. JavaScript 파일에서는 코어 규칙의
  옵션(`args: none`)이 적용됩니다.
- `react/jsx-*` 규칙은 설정이 명시적으로 켜므로 `react`가 의존성에 없어도
  실행됩니다.

## 사용법

### `please-style`로 적용

```bash
bunx @pleaseai/code-style init   # bun-lint-config 선택
```

`init`은 이 패키지를 설치하고 `lint.toml`을 `bunfig.toml`의
`# >>> @pleaseai/bun-lint-config`와 `# <<< @pleaseai/bun-lint-config` 주석 사이에
씁니다. 업그레이드한 뒤 `init`을 다시 실행하면 블록이 갱신되고, `bunfig.toml`의
나머지는 그대로 유지됩니다. 블록 밖에 이미 lint 설정이 있으면 `init`은 파일을
건드리지 않고 그 설정을 먼저 지우라고 안내합니다.

### 직접 복사

```bash
bun add -D @pleaseai/bun-lint-config
cat node_modules/@pleaseai/bun-lint-config/lint.toml >> bunfig.toml
```

테이블은 `bunfig.toml`의 맨 끝에 두세요. 테이블 뒤에 오는 키는 마지막 테이블에
속하게 됩니다. 업그레이드한 뒤에는 파일을 다시 복사하세요.

`bun --config=node_modules/@pleaseai/bun-lint-config/lint.toml lint`는 같은 방법이
아닙니다. `--config`는 `bunfig.toml`에 더하는 것이 아니라 `bunfig.toml`을
대신하므로, bunfig의 나머지 설정을 읽지 않습니다.

### `bun lint` 실행

- `package.json`에 `lint` 스크립트가 있으면 `bun lint`가 그 스크립트를 실행합니다.
  `bun lint --no-script`로 실행하거나 스크립트를 `bun lint`로 바꾸세요.
- `eslint.config.*` 파일과 함께 쓰지 마세요. ESLint 설정이 있으면 `bun lint`는 그
  설정을 읽고 그 위에 `[lint]` 키를 적용하므로, 둘 중 하나만 사용하세요.

## 다시 생성하기

`lint.toml`은 `@pleaseai/eslint-config`와, Bun이 네이티브로 실행하는 규칙을 커밋해
둔 스냅숏인 `builtin-rules.json` 두 가지에서 생성합니다. `lint.toml`이 둘 중 하나와
맞지 않으면 테스트가 실패합니다.

```bash
# `bun lint`가 있는 Bun 빌드로 스냅숏을 갱신합니다.
BUN_LINT_BIN=/path/to/bun-canary bun run update-rules
# lint.toml을 다시 생성합니다.
bun run generate
```

ESLint 설정이 Bun.Glob으로 표현할 수 없는 glob(`?(…)` 외의 extglob)이나 TOML로
표현할 수 없는 규칙 옵션(`null`, 함수, 정규식)을 쓰면 생성기가 실패합니다.

## 라이선스

MIT
