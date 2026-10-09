# @pleaseai/code-style

[English](./README.md) | 한국어

PleaseAI 프로젝트를 위한 공유 코드 스타일 설정 모노레포 — 외주, 오픈소스, 사내 프로젝트 모두에서 사용합니다.

전체 가이드는 [code-style 문서 사이트](https://code-style.pages.dev)에서 확인하세요.

## 패키지

| 패키지 | 설명 |
|--------|------|
| [`@pleaseai/eslint-config`](./packages/eslint-config) | PleaseAI 기본값이 적용된 `@antfu/eslint-config` 래퍼 ESLint flat config |
| [`@pleaseai/prettier-config`](./packages/perttier-config) | 공유 Prettier 설정 (JSON) |
| [`@pleaseai/editorconfig`](./packages/editorconfig) | 일관된 에디터 설정을 위한 공유 `.editorconfig` |

## `@pleaseai/eslint-config`

### 설치

```sh
bun add -D @pleaseai/eslint-config eslint
```

### 사용법

```ts
// eslint.config.ts
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
```

커스텀 오버라이드:

```ts
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai(
  {
    // 기본값 오버라이드 (typescript, stylistic, gitignore는 이미 설정되어 있음)
    vue: true,
  },
  // 추가 flat config 엔트리
  {
    rules: {
      'no-console': 'warn',
    },
  },
)
```

### 기본값

- `stylistic`: `indent: 2`, `quotes: 'single'`, `semi: false`
- `typescript: true`
- `gitignore: true`

## 개발

로컬에서 저장소를 설정하고 빌드·린트하는 방법은 [CONTRIBUTING.md의 Getting started](./CONTRIBUTING.md#getting-started)(영문)를 따르세요.

### 릴리즈

릴리스는 Conventional Commits 기반으로 [release-please](https://github.com/googleapis/release-please)가 자동화하며, GitHub Actions가 provenance와 함께 npm에 배포합니다.
