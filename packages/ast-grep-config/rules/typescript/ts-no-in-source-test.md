# `ts-no-in-source-test`

| | |
| --- | --- |
| Slug | `test-path-derivable-from-source` |
| Language | TypeScript (`.ts`, `.mts`, `.cts`) |
| Severity | `warning` |
| Enforcement layer | 2 (ast-grep) — [ADR-0022](https://github.com/chatbot-pf/engineering-standards/blob/main/docs/adr/0022-agent-navigable-code-organization-standard.md) |

## Why

The standard puts every test under the package's test root (`test/` or
`tests/`), at a path mirrored from the source it covers. Vitest
[in-source tests](https://vitest.dev/guide/in-source.html)
(`if (import.meta.vitest) { … }`) break that:

- a `test/**` glob cannot find them, so neither agents nor tools such as
  SonarQube `test.inclusions` treat them as tests (they count as duplicated
  source instead);
- production builds need a bundler `define` to strip them;
- TypeScript can test through exports, so the private access they offer is not
  needed. Rust's `#[cfg(test)]` exception does not carry over.

## Wrong

```ts
// src/math/add.ts
export function add(a: number, b: number): number {
  return a + b
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest
  it('adds', () => {
    expect(add(1, 2)).toBe(3)
  })
}
```

## Right

```ts
// src/math/add.ts
export function add(a: number, b: number): number {
  return a + b
}
```

```ts
// test/math/add.test.ts
import { describe, expect, it } from 'vitest'
import { add } from '../../src/math/add'

describe('add', () => {
  it('adds', () => {
    expect(add(1, 2)).toBe(3)
  })
})
```

## How to fix

1. Work out the test path: take the source path relative to the package, drop
   a single source root (`src/`), and put the result under the package's test
   root with a `.test.ts` suffix — `src/math/add.ts` becomes
   `test/math/add.test.ts`. If the package has several source roots (Nuxt
   `app/`, `server/`, `shared/`), keep the root name:
   `server/utils/db.ts` becomes `test/server/utils/db.test.ts`. Use the test
   root the package already has (`test/` or `tests/`).
2. Move the block's body into that file. Replace `import.meta.vitest` with
   `import { … } from 'vitest'` and import what you test by name.
3. If the test used a non-exported helper, test it through the exported
   function that calls it instead of exporting the helper.
4. Delete the `if (import.meta.vitest)` block. If no file uses in-source tests
   any more, remove `includeSource` from the Vitest config and the
   `import.meta.vitest` `define` from the build config.
5. Run the test runner's list command (`vitest list`) before and after and
   check the test count did not drop: a runner that finds no tests still exits
   with success.
