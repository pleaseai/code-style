import type { TypedFlatConfigItem } from '@antfu/eslint-config'
import type { ESLint } from 'eslint'
import { GLOB_MARKDOWN_CODE, GLOB_SRC } from '@antfu/eslint-config'
import { eslintCompatPlugin } from '@oxlint/plugins'
import plugin from './vendor/index.js'

eslintCompatPlugin(plugin)

export const pluginQuality: ESLint.Plugin = plugin

export function quality(): TypedFlatConfigItem[] {
  return [
    {
      name: 'pleaseai/quality/setup',
      plugins: { quality: pluginQuality },
    },
    {
      name: 'pleaseai/quality/rules',
      files: [GLOB_SRC],
      ignores: [GLOB_MARKDOWN_CODE],
      rules: Object.fromEntries(Object.keys(pluginQuality.rules ?? {}).map(id => [`quality/${id}`, 'error'])),
    },
  ]
}
