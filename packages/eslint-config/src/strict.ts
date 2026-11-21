import type { TypedFlatConfigItem } from '@antfu/eslint-config'
import { GLOB_MARKDOWN_CODE, GLOB_SRC } from '@antfu/eslint-config'

export interface StrictOptions {
  /** Whether antfu loads the `ts` plugin. */
  typescript: boolean
  /** Whether antfu loads the `unicorn` plugin. */
  unicorn: boolean
  /** Name the import plugin is registered under, or `false` when antfu does not load it. */
  importPlugin: string | false
  /** Rule IDs the consumer already set through antfu's override options; strict leaves them alone. */
  skip?: ReadonlySet<string>
}

/** Rules that antfu leaves off or loose, at `'error'`. A rule is left out when antfu does not load its plugin. */
export function strict(options: StrictOptions): TypedFlatConfigItem[] {
  const rules: NonNullable<TypedFlatConfigItem['rules']> = {
    'eqeqeq': ['error', 'always'],
    'no-promise-executor-return': 'error',
  }
  if (options.unicorn) {
    rules['unicorn/prefer-set-has'] = 'error'
  }
  if (options.typescript) {
    rules['ts/no-confusing-non-null-assertion'] = 'error'
  }

  if (options.importPlugin !== false) {
    rules[`${options.importPlugin}/no-self-import`] = 'error'
  }

  for (const id of options.skip ?? []) {
    delete rules[id]
  }

  return [
    {
      name: 'pleaseai/strict/rules',
      files: [GLOB_SRC],
      ignores: [GLOB_MARKDOWN_CODE],
      rules,
    },
  ]
}
