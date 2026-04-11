# @pleaseai/code-style

[English](./README.md) | 한국어

PleaseAI의 공유 코드 스타일을 어떤 프로젝트에도 적용해 주는 CLI입니다 —
eslint/prettier/editorconfig 패키지를 설치하고, AI 코딩 어시스턴트가 처음부터
린트를 통과하는 코드를 작성할 수 있도록 `AGENTS.md`의 규칙 블록을 관리합니다.

[ultracite](https://github.com/haydenbleasel/ultracite)와 네이버페이의
[`@naverpay/code-style-cli`](https://github.com/NaverPayDev/code-style)에서 영감을 받았습니다.

## 사용법

`package.json`이 있는 프로젝트 루트에서 실행하세요:

```bash
bunx @pleaseai/code-style         # `init`과 동일
bunx @pleaseai/code-style init    # 대화형 설정
bunx @pleaseai/code-style update  # AGENTS.md 규칙 블록만 다시 적용
bunx @pleaseai/code-style doctor  # 현재 프로젝트 상태 확인
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
