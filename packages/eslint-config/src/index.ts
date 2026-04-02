import type { OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import antfu from '@antfu/eslint-config'

export function pleaseai(
  options: OptionsConfig = {},
  ...userConfigs: TypedFlatConfigItem[]
): ReturnType<typeof antfu> {
  return antfu(
    {
      lessOpinionated: true,
      stylistic: {
        indent: 2,
        quotes: 'single',
        semi: false,
      },
      typescript: true,
      gitignore: true,
      rules: {
        'antfu/top-level-function': 'error',
        'test/prefer-lowercase-title': 'off',
      },
      ...options,
    },
    ...userConfigs,
  )
}

export * from '@antfu/eslint-config'
export default pleaseai
