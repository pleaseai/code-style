import type { OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import type { ESLint, Linter } from 'eslint'
import antfu, { defaultPluginRenaming, GLOB_SRC } from '@antfu/eslint-config'

export interface PleaseaiOptions extends OptionsConfig, Omit<TypedFlatConfigItem, 'files' | 'ignores'> {
  /**
   * Register plugins under the names and packages that Bun's `bun lint` runs
   * natively:
   *
   * - typescript-eslint rules are reported as `@typescript-eslint/*` instead
   *   of `ts/*`.
   * - `import/*` rules come from `eslint-plugin-import` instead of
   *   `eslint-plugin-import-lite`. It must be installed separately.
   *
   * Rule IDs change, so `eslint-disable` comments that name `ts/*` rules must
   * be updated. Rule settings in this config that use `ts/*` are renamed for
   * you.
   *
   * @default false
   */
  canonicalPluginNames?: boolean
}

const { '@typescript-eslint': _ts, 'import-lite': _importLite, ...keptPluginRenaming } = defaultPluginRenaming

/** antfu's renaming, with typescript-eslint back under its own name. */
const canonicalPluginRenaming: Record<string, string> = {
  ...keptPluginRenaming,
  ts: '@typescript-eslint',
}

/** `eslint-plugin-import-lite` and `eslint-plugin-import` spell these options differently. */
const typeSpecifierStyles = new Map([
  ['top-level', 'prefer-top-level'],
  ['inline', 'prefer-inline'],
])

async function loadEslintPluginImport(): Promise<ESLint.Plugin> {
  try {
    const plugin = await import('eslint-plugin-import')
    return (plugin.default ?? plugin) as ESLint.Plugin
  }
  catch (error) {
    throw new Error(
      '`canonicalPluginNames` requires `eslint-plugin-import`. Install it with `bun add -D eslint-plugin-import`.',
      { cause: error },
    )
  }
}

function toPreferTypeSpecifierStyle(entry: Linter.RuleEntry): Linter.RuleEntry {
  if (!Array.isArray(entry) || typeof entry[1] !== 'string') {
    return entry
  }
  const [severity, style, ...rest] = entry
  return [severity, typeSpecifierStyles.get(style) ?? style, ...rest]
}

function useEslintPluginImportOptions(configs: TypedFlatConfigItem[]): void {
  for (const config of configs) {
    // Plugin renaming has already copied every `rules` object, so it is safe
    // to update in place. The typed rules only allow import-lite's values.
    const rules: Record<string, Linter.RuleEntry | undefined> | undefined = config.rules
    const entry = rules?.['import/consistent-type-specifier-style']
    if (rules && entry !== undefined) {
      rules['import/consistent-type-specifier-style'] = toPreferTypeSpecifierStyle(entry)
    }
  }
}

/**
 * The universal entry targets every non-JS language antfu knows (stylesheets,
 * HTML, XML, Vue, Svelte, JSON, Markdown, YAML, TOML, GraphQL). Listing them
 * makes ESLint lint those files, and where no config parses them it reads them
 * as JavaScript and reports parsing errors. Keep only the JS/TS glob there, and
 * run the rule on the other languages only inside the scope (`files`,
 * `ignores`, `basePath`) of each config that sets a parser or language, so
 * enabling antislop lints no new files. A nested array in `files` matches a
 * file only when every glob in it does, so `[pattern, glob]` intersects the
 * parser's scope with one language. Pairs that can never match (a TS glob and a
 * CSS glob) are kept: they cost one glob test, while guessing overlap from file
 * extensions could drop a real match.
 */
function scopeAntislopToParsedFiles(configs: TypedFlatConfigItem[]): TypedFlatConfigItem[] {
  const universal = configs.find(config => config.name === 'antfu/antislop/rules/universal')
  if (!universal?.files) {
    return configs
  }
  const otherLanguages = universal.files.filter(glob => glob !== GLOB_SRC)
  const parsed = configs.flatMap((config) => {
    const { basePath, files, ignores, language, languageOptions } = config
    if (config === universal || !files || !(languageOptions?.parser || language)) {
      return []
    }
    return [{
      name: 'pleaseai/antislop/rules/parsed',
      ...(basePath ? { basePath } : {}),
      files: files.flatMap(pattern => otherLanguages.map(glob => [pattern, glob].flat())),
      ignores: [...(ignores ?? []), ...(universal.ignores ?? [])],
      rules: universal.rules,
    }]
  })
  universal.files = universal.files.filter(glob => glob === GLOB_SRC)
  const index = configs.indexOf(universal)
  return [...configs.slice(0, index + 1), ...parsed, ...configs.slice(index + 1)]
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
      ...antfuOptions,
      rules: {
        'antfu/top-level-function': 'error',
        'test/prefer-lowercase-title': 'off',
        ...antfuOptions.rules,
      },
      // antfu's renaming maps `@typescript-eslint` to `ts`, which would undo
      // the rename below for configs that register the canonical name.
      ...(canonicalPluginNames ? { autoRenamePlugins: false } : {}),
    },
    ...userConfigs,
  ).onResolved(scopeAntislopToParsedFiles)

  if (!canonicalPluginNames) {
    return composer
  }

  return composer
    .renamePlugins(autoRenamePlugins ? canonicalPluginRenaming : { ts: '@typescript-eslint' })
    .replacePlugin('import', () => loadEslintPluginImport())
    .onResolved(useEslintPluginImportOptions)
}

export * from '@antfu/eslint-config'
export default pleaseai
