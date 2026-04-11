---
seo:
  title: PleaseAI Code Style
  description: PleaseAI 프로젝트 전반에 걸쳐 일관된 코드 스타일을 유지하기 위한 공유 ESLint, Prettier, EditorConfig 설정.
navigation: false
---

<!-- eslint-disable markdown/no-missing-atx-heading-space -->

::u-page-hero
#title
PleaseAI Code Style

#description
PleaseAI 프로젝트를 위한 공유 ESLint, Prettier, EditorConfig 설정 — 이 모든 것을 한 번에 연결해 주는 CLI도 함께 제공합니다.

#links
  :::u-button
  ---
  color: neutral
  size: xl
  to: /ko/cli
  trailing-icon: i-lucide-arrow-right
  ---
  시작하기
  :::

  :::u-button
  ---
  color: neutral
  icon: i-simple-icons-github
  size: xl
  target: _blank
  to: https://github.com/pleaseai/code-style
  variant: outline
  ---
  GitHub에서 보기
  :::
::

::u-page-section
#title
패키지

#description
일관된 코드 스타일에 필요한 모든 것을, 목적이 분명한 패키지로 제공합니다.

  :::u-page-grid
    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-shield-check
    spotlight: true
    to: /ko/eslint-config
    ---
    #title
    ESLint Config

    #description
    `@antfu/eslint-config` 위에 구축된 의견이 반영된 ESLint flat config.
    ::::

    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-paintbrush
    spotlight: true
    to: /ko/prettier-config
    ---
    #title
    Prettier Config

    #description
    일관된 포매팅을 위한 공유 Prettier 설정.
    ::::

    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-file-cog
    spotlight: true
    to: /ko/editorconfig
    ---
    #title
    EditorConfig

    #description
    일관된 에디터 설정을 위한 공유 `.editorconfig`.
    ::::

    ::::u-page-card
    ---
    class: col-span-2 lg:col-span-1
    icon: i-lucide-terminal
    spotlight: true
    to: /ko/cli
    ---
    #title
    CLI

    #description
    eslint, prettier, editorconfig, 그리고 `AGENTS.md` 규칙 블록을 한 번에 설정.
    ::::
  :::
::

::u-page-section
#title
빠른 시작

#description
가장 빠른 방법은 CLI입니다 — 패키지를 설치하고 설정 파일까지 자동으로 작성해 줍니다.

:::code-group
```bash [bun]
bunx @pleaseai/code-style
```

```bash [pnpm]
pnpm dlx @pleaseai/code-style
```

```bash [npm]
npx @pleaseai/code-style
```
:::

직접 연결하고 싶다면, ESLint 설정을 바로 설치할 수 있습니다:

:::code-group
```bash [bun]
bun add -D @pleaseai/eslint-config eslint
```

```bash [pnpm]
pnpm add -D @pleaseai/eslint-config eslint
```

```bash [npm]
npm install -D @pleaseai/eslint-config eslint
```
:::

```ts [eslint.config.ts]
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
```
::
