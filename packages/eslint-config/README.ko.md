# @pleaseai/eslint-config

[English](./README.md) | 한국어

[![npm](https://img.shields.io/npm/v/@pleaseai/eslint-config?color=444&label=)](https://npmjs.com/package/@pleaseai/eslint-config)

[@antfu/eslint-config](https://github.com/antfu/eslint-config) 위에 구축된 PleaseAI의 공유 ESLint 설정입니다.

- PleaseAI 기본값이 적용된 `@antfu/eslint-config` 기반
- 포매팅 자동 수정 (Prettier **없이** 독립적으로 사용하도록 설계됨)
- [ESLint Flat config](https://eslint.org/docs/latest/use/configure/configuration-files-new), 쉽게 조합 가능!
- TypeScript, JSX, Vue, JSON, YAML, Markdown 등 기본 지원
- 선택적 [React](#react), [Nextjs](#nextjs), [Svelte](#svelte), [UnoCSS](#unocss), [Astro](#astro), [Solid](#solid), [Angular](#angular) 지원
- CSS, HTML, XML 등을 위한 선택적 [포매터](#포매터) 지원
- [`eslint-plugin-package-json`](#package-json-린트) 설정 포함
- ESLint v9.10.0 이상 필요

## PleaseAI 기본값

이 설정은 `@antfu/eslint-config`를 다음 기본값으로 감쌉니다:

| 옵션 | 값 |
|------|-----|
| 들여쓰기 | 공백 2칸 |
| 따옴표 | 홑따옴표 |
| 세미콜론 | 없음 |
| TypeScript | 활성화 |
| Gitignore | 활성화 |
| `lessOpinionated` | `true` — `antfu/if-newline`과 `antfu/curly`를 비활성화하고 `curly: ['error', 'all']`을 활성화 |
| `antfu/top-level-function` | 재활성화 — 최상위 레벨에서는 `function` 선언 선호 |

추가로 `test/prefer-lowercase-title`은 비활성화되어 있습니다.

## 사용법

### 설치

```bash
bun add -D @pleaseai/eslint-config eslint
```

### 설정

프로젝트 루트에 `eslint.config.ts` (또는 `eslint.config.mjs`)를 생성합니다:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
```

### `package.json`에 스크립트 추가

```json
{
  "scripts": {
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  }
}
```

## 커스터마이징

`pleaseai()` 함수는 `antfu()`와 동일한 옵션을 받습니다. `@antfu/eslint-config`의 모든 옵션을 지원합니다.

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  // PleaseAI 기본값 오버라이드
  stylistic: {
    indent: 4,
  },

  // 프레임워크 지원 활성화
  vue: true,
  react: true,

  // ignore 추가
  ignores: [
    '**/fixtures',
  ],
})
```

추가 flat config를 별도 인자로 전달할 수도 있습니다:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai(
  {
    // PleaseAI + antfu 옵션
    typescript: true,
  },
  // 추가 ESLint flat config
  {
    files: ['**/*.ts'],
    rules: {
      'ts/consistent-type-definitions': ['error', 'interface'],
    },
  },
)
```

### Config Composer

팩토리 함수 `pleaseai()`는 [`eslint-flat-config-utils`의 `FlatConfigComposer` 객체](https://github.com/antfu/eslint-flat-config-utils#composer)를 반환하므로, 메서드 체이닝으로 더 유연하게 설정을 구성할 수 있습니다:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
  .prepend(
    // 메인 설정 앞에 들어가는 flat config들
  )
  // 이름이 붙은 config 블록을 오버라이드
  .override(
    'antfu/stylistic/rules',
    {
      rules: {
        'style/generator-star-spacing': ['error', { after: true, before: false }],
      },
    },
  )
  // 플러그인 prefix 이름 변경
  .renamePlugins({
    'old-prefix': 'new-prefix',
    // ...
  })
  // 이름이 붙은 config 블록을 완전히 제거
  .remove('antfu/stylistic')
```

`pleaseai({ ... })` 옵션이 충분히 세밀하지 않을 때 사용할 수 있는 조합형 탈출구입니다.

### 규칙 오버라이드

각 통합 옵션의 `overrides` 옵션을 사용하세요:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  vue: {
    overrides: {
      'vue/operator-linebreak': ['error', 'before'],
    },
  },
  typescript: {
    overrides: {
      'ts/consistent-type-definitions': ['error', 'interface'],
    },
  },
})
```

### 타입 인지(Type Aware) 규칙

`tsconfigPath`를 전달하여 [타입 인지 규칙](https://typescript-eslint.io/linting/typed-linting/)을 활성화할 수 있습니다:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  typescript: {
    tsconfigPath: 'tsconfig.json',
  },
})
```

## 선택적 설정

### React

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  react: true,
})
```

```bash
bun add -D @eslint-react/eslint-plugin eslint-plugin-react-refresh
```

### Nextjs

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  nextjs: true,
})
```

```bash
bun add -D @next/eslint-plugin-next
```

### Vue

Vue 지원은 자동 감지됩니다. 명시적으로 활성화할 수도 있습니다:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  vue: true,
})
```

### Svelte

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  svelte: true,
})
```

```bash
bun add -D eslint-plugin-svelte
```

### Astro

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  astro: true,
})
```

```bash
bun add -D eslint-plugin-astro
```

### Solid

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  solid: true,
})
```

```bash
bun add -D eslint-plugin-solid
```

### UnoCSS

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  unocss: true,
})
```

```bash
bun add -D @unocss/eslint-plugin
```

### Angular

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  angular: true,
})
```

```bash
bun add -D @angular-eslint/eslint-plugin @angular-eslint/eslint-plugin-template @angular-eslint/template-parser
```

### 선택적 규칙 — `command`

`@antfu/eslint-config`에는 [`eslint-plugin-command`](https://github.com/antfu/eslint-plugin-command)가 포함되어 있으며, `@pleaseai/eslint-config`도 이를 상속합니다. 일반적인 린트 규칙이 **아니라** — 특정 triple-slash 주석에 반응하는 온디맨드 마이크로 codemod입니다.

기본 제공되는 트리거 몇 가지:

- `/// to-function` — arrow function을 `function` 선언으로 변환
- `/// to-arrow` — `function` 선언을 arrow function으로 변환
- `/// to-for-each` — `for` 루프를 `.forEach()`로 변환
- `/// to-for-of` — `.forEach()`를 `for-of`로 변환
- `/// keep-sorted` — 다음 객체/배열/인터페이스를 정렬
- …전체 목록은 [플러그인 문서](https://github.com/antfu/eslint-plugin-command#built-in-commands)에서 확인하세요

변환하려는 코드 한 줄 위에 트리거를 배치합니다:

<!-- eslint-skip -->

```ts
/// to-function
const foo = async (msg: string): Promise<void> => {
  console.log(msg)
}
```

다음 `eslint --fix` (또는 저장 시 자동 수정)에서 다음과 같이 변환됩니다:

```ts
async function foo(msg: string): Promise<void> {
  console.log(msg)
}
```

트리거 주석은 일회성으로, 변환과 함께 제거됩니다.

### 포매터

ESLint가 아직 처리하지 못하는 파일(`.css`, `.html` 등)에는 외부 포매터를 사용하세요:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  formatters: {
    css: true,
    html: true,
    markdown: 'prettier',
  },
})
```

```bash
bun add -D eslint-plugin-format
```

## Package JSON 린트

이 패키지는 `eslint-plugin-package-json` 설정도 함께 export합니다:

```js
import { recommended, stylistic } from '@pleaseai/eslint-config/package-json'
```

- `recommended` — `eslint-plugin-package-json` recommended-publishable 설정
- `stylistic` — `eslint-plugin-package-json` stylistic 설정

## IDE 지원 (저장 시 자동 수정)

### VS Code

[VS Code ESLint 확장](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)을 설치하고 `.vscode/settings.json`에 다음을 추가합니다:

```jsonc
{
  // 기본 포매터를 비활성화하고 eslint를 사용
  "prettier.enable": false,
  "editor.formatOnSave": false,

  // 자동 수정
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },

  // IDE에서 스타일 규칙은 조용히, 하지만 자동 수정은 유지
  "eslint.rules.customizations": [
    { "rule": "style/*", "severity": "off", "fixable": true },
    { "rule": "format/*", "severity": "off", "fixable": true },
    { "rule": "*-indent", "severity": "off", "fixable": true },
    { "rule": "*-spacing", "severity": "off", "fixable": true },
    { "rule": "*-spaces", "severity": "off", "fixable": true },
    { "rule": "*-order", "severity": "off", "fixable": true },
    { "rule": "*-dangle", "severity": "off", "fixable": true },
    { "rule": "*-newline", "severity": "off", "fixable": true },
    { "rule": "*quotes", "severity": "off", "fixable": true },
    { "rule": "*semi", "severity": "off", "fixable": true }
  ],

  // 지원하는 모든 언어에 eslint 활성화
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "vue",
    "html",
    "markdown",
    "json",
    "jsonc",
    "yaml",
    "toml",
    "xml",
    "gql",
    "graphql",
    "astro",
    "svelte",
    "css",
    "less",
    "scss",
    "pcss",
    "postcss"
  ]
}
```

### Neovim

Neovim에서 저장 시 포맷팅을 받는 몇 가지 방법:

- **`nvim-lspconfig`**는 `EslintFixAll` 명령을 제공합니다. `BufWritePre`에서 실행되는 autocmd를 생성하세요:

  ```lua
  lspconfig.eslint.setup({
    on_attach = function(client, bufnr)
      vim.api.nvim_create_autocmd('BufWritePre', {
        buffer = bufnr,
        command = 'EslintFixAll',
      })
    end,
  })
  ```

- [`conform.nvim`](https://github.com/stevearc/conform.nvim)
- [`none-ls.nvim`](https://github.com/nvimtools/none-ls.nvim)
- [`nvim-lint`](https://github.com/mfussenegger/nvim-lint)

### 에디터 전용 비활성화

ESLint가 코드 에디터 안에서 실행될 때, 일부 규칙은 **자동 수정이 비활성화**됩니다. 이렇게 해야 작성 중인 코드를 에디터가 공격적으로 다시 쓰지 않습니다:

- [`prefer-const`](https://eslint.org/docs/rules/prefer-const)
- [`test/no-only-tests`](https://github.com/levibuzolic/eslint-plugin-no-only-tests)
- [`unused-imports/no-unused-imports`](https://www.npmjs.com/package/eslint-plugin-unused-imports)
- `pnpm/json-enforce-catalog`
- `pnpm/json-prefer-workspace-settings`
- `pnpm/json-valid-catalog`

> `@antfu/eslint-config` v3.16.0부터는 이 규칙들이 비활성화되는 대신 에디터 모드에서 **수정 불가(non-fixable)** 상태가 됩니다. 여전히 리포트는 되지만 빠른 수정(quick-fix) 액션이 제공되지 않습니다.

동기: 방금 붙여넣은 미사용 import가 에디터 자동 저장 순간 사라져서는 안 됩니다. 이 규칙들은 터미널에서 `eslint`를 실행하거나 [Lint Staged](#lint-staged)를 통해 실행될 때는 여전히 적용됩니다. 에디터와 CLI에서 동일한 동작을 원한다면 opt-out할 수 있습니다:

```js
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  isInEditor: false,
})
```

### Lint Staged

```json
{
  "simple-git-hooks": {
    "pre-commit": "bun lint-staged"
  },
  "lint-staged": {
    "*": "eslint --fix"
  }
}
```

```bash
bun add -D lint-staged simple-git-hooks
npx simple-git-hooks
```

## 활성화된 규칙 보기

[@eslint/config-inspector](https://github.com/eslint/config-inspector)로 활성화된 규칙을 시각화할 수 있습니다:

```bash
npx @eslint/config-inspector
```

## 플러그인 이름 변경

이 설정은 일관된 DX를 위해 `@antfu/eslint-config`의 플러그인 이름 변경을 상속받습니다:

| 새 Prefix | 원본 Prefix | 소스 플러그인 |
|------------|-----------------|---------------|
| `import/*` | `import-lite/*` | [eslint-plugin-import-lite](https://github.com/9romise/eslint-plugin-import-lite) |
| `node/*` | `n/*` | [eslint-plugin-n](https://github.com/eslint-community/eslint-plugin-n) |
| `yaml/*` | `yml/*` | [eslint-plugin-yml](https://github.com/ota-meshi/eslint-plugin-yml) |
| `ts/*` | `@typescript-eslint/*` | [@typescript-eslint/eslint-plugin](https://github.com/typescript-eslint/typescript-eslint) |
| `style/*` | `@stylistic/*` | [@stylistic/eslint-plugin](https://github.com/eslint-stylistic/eslint-stylistic) |
| `test/*` | `vitest/*` | [@vitest/eslint-plugin](https://github.com/vitest-dev/eslint-plugin-vitest) |

## 버전 정책

`@pleaseai/eslint-config`는 [Semantic Versioning](https://semver.org/)을 따르지만, 여러 가지가 얽힌 스타일 프리셋이기 때문에 **규칙 변경은 breaking change로 취급하지 않습니다**. 아래 표는 `@antfu/eslint-config`에서 상속받은 정책과 동일합니다.

### Breaking으로 간주

- Node.js 버전 요구사항 변경
- 다운스트림 설정을 깨뜨릴 수 있는 대규모 리팩터
- 기존 규칙을 깨뜨릴 수 있는 주요 플러그인 업그레이드
- 대부분의 코드베이스에 영향을 미칠 가능성이 높은 변경

### Breaking이 아닌 것으로 간주

- 개별 규칙/플러그인 활성화 또는 비활성화 (엄격해지더라도)
- 규칙 옵션 변경
- 의존성 버전 업데이트

규칙 강화로 인해 lint가 깨진다면 이전 minor 버전으로 고정하고, 트레이드오프를 논의할 수 있도록 이슈를 열어 주세요.

## FAQ

### Prettier?

이 설정은 린트와 포매팅 모두에 ESLint를 사용하므로 Prettier가 필요하지 않습니다. Anthony Fu의 [Why I don't use Prettier](https://antfu.me/posts/why-not-prettier)를 참고하세요.

ESLint가 아직 처리하지 못하는 파일(`.css`, `.html` 등)을 포매팅해야 한다면 [formatters](#포매터) 옵션을 사용하세요.

### CSS를 어떻게 포매팅하나요?

[`formatters`](#포매터) 기능을 opt-in하여 CSS를 포매팅할 수 있습니다. 단, 린트가 아니라 포매팅만 수행합니다. 제대로 된 린트 지원이 필요하다면 [`stylelint`](https://stylelint.io/)을 검토하세요.

### 최상위 함수 스타일?

PleaseAI는 `lessOpinionated: true` 위에서 `antfu/top-level-function`을 재활성화합니다. 따라서 최상위 함수는 `const`에 할당된 arrow function이 아닌 `function` 선언을 사용해야 합니다:

```ts
// ✓ 권장
export function greet(name: string) {
  return `Hello, ${name}`
}

// ✗ 경고
export const greet = (name: string) => `Hello, ${name}`
```

함수 본문 내부, 콜백, 인라인 JSX 핸들러의 arrow function은 여전히 문제없습니다 — 이 규칙은 최상위 선언만 대상으로 합니다. 이 선택에 동의하지 않는다면 오버라이드할 수 있습니다:

```ts
import pleaseai from '@pleaseai/eslint-config'

export default pleaseai({
  rules: {
    'antfu/top-level-function': 'off',
  },
})
```

### 중괄호 스타일?

PleaseAI의 기본값은 `lessOpinionated: true`이며, 이는 `curly: ['error', 'all']`을 강제합니다 — 제어문 본문에는 항상 중괄호를 요구합니다:

```js
// PleaseAI 스타일 — 항상 중괄호 필요
function example() {
  if (foo) {
    return true
  }
}
```

antfu 기본값(`lessOpinionated: false`)은 개행이 있는 중괄호 없는 한 줄짜리 `if`를 허용하지만, PleaseAI는 `curly: ['error', 'all']`을 강제합니다.

참고: `antfu/top-level-function`이 재활성화되어 있으므로, 최상위 `function` 선언이 여전히 arrow function보다 선호됩니다.

## Re-exports

`@antfu/eslint-config`의 모든 export가 다시 export되므로, 세부 config를 직접 import할 수 있습니다:

```js
import { combine, javascript, typescript, vue } from '@pleaseai/eslint-config'
```

## 라이선스

[MIT](./LICENSE)
