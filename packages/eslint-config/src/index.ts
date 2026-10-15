import type { OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import antfu, { defaultPluginRenaming } from '@antfu/eslint-config'

export interface PleaseaiOptions extends OptionsConfig {
  /**
   * Register `@typescript-eslint` and `n` under their canonical names instead
   * of antfu's `ts` and `node`, so linters that match plugins by name (e.g.
   * `bun lint`) can run their rules natively. Rule IDs change accordingly
   * (`ts/*` → `@typescript-eslint/*`, `node/*` → `n/*`); `ts/*` and `node/*`
   * keys in config `rules` are renamed too, but inline disable comments are not.
   *
   * @default false
   */
  canonicalPluginNames?: boolean
}

const canonicalPluginRenaming: Record<string, string> = {
  ts: '@typescript-eslint',
  node: 'n',
}

export function pleaseai(
  options: PleaseaiOptions = {},
  ...userConfigs: TypedFlatConfigItem[]
): ReturnType<typeof antfu> {
  const { canonicalPluginNames = false, ...antfuOptions } = options
  const autoRenamePlugins = antfuOptions.autoRenamePlugins ?? true

  const composer = antfu(
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
      ...antfuOptions,
      // Renames apply in a single pass, so antfu's `@typescript-eslint` → `ts`
      // and `n` → `node` entries must be dropped rather than reversed on top.
      ...(canonicalPluginNames && { autoRenamePlugins: false }),
    },
    ...userConfigs,
  )

  if (!canonicalPluginNames) {
    return composer
  }

  const renames: Record<string, string> = autoRenamePlugins
    ? Object.fromEntries(
        Object.entries(defaultPluginRenaming)
          .filter(([, to]) => !(to in canonicalPluginRenaming)),
      )
    : {}

  return composer.renamePlugins({ ...renames, ...canonicalPluginRenaming })
}

export * from '@antfu/eslint-config'
export default pleaseai
