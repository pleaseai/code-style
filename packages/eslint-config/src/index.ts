import type { OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import type { ESLint, Linter } from 'eslint'
import type { PleaseaiFormatters } from './bun-fmt'
import { createRequire } from 'node:module'
import antfu, { defaultPluginRenaming, GLOB_SRC } from '@antfu/eslint-config'
import { resolveAntislop, scopeAntislopToParsedFiles } from './antislop'
import { bunFmt, splitBunFormatter } from './bun-fmt'
import { quality } from './quality'
import { RESOLVER_NAME, strict, strictOverrides, yieldImportResolver } from './strict'

export type { PleaseaiFormatters } from './bun-fmt'

export interface PleaseaiOptions extends Omit<OptionsConfig, 'formatters'>, Omit<TypedFlatConfigItem, 'files' | 'ignores'> {
  /**
   * Enable the anti-slop rules from `eslint-plugin-slop` and a curated subset
   * of `eslint-plugin-sonarjs`. Both plugins are optional peer dependencies.
   *
   * Left unset, each plugin's rules turn on when that plugin is installed.
   * `true` requires both plugins. An object requires each plugin it turns on
   * explicitly (a numeric `cognitiveComplexity` turns on `sonarjs`), and a
   * plugin it does not mention follows what is installed. An object that ends
   * up turning on neither plugin leaves antislop off.
   * In Markdown, `slop/no-em-dash` is a warning.
   *
   * @default true for each installed plugin, otherwise false
   */
  antislop?: OptionsConfig['antislop']
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
  /**
   * Format files that ESLint cannot handle natively. Same as antfu's
   * `formatters`, plus `markdown: 'bun'`: `.md` and `.mdx` are formatted with
   * `bun fmt` (a stable Bun 1.4.4 or later on `PATH`) through the `pleaseai/bun-fmt`
   * rule. Code blocks and MDX JSX are not formatted, `bun fmt` reads the
   * `[fmt]` section of `bunfig.toml` in ESLint's working directory, and
   * `eslint-plugin-format` is only needed for the other formatters.
   *
   * @default false
   */
  formatters?: boolean | PleaseaiFormatters
  /**
   * Enable the `quality/*` rules vendored from
   * [anti-slop](https://github.com/dmmulroy/anti-slop). They reject
   * low-evidence typing: widening known values to `unknown` and asserting
   * them back, chained type assertions, `unknown` returns and aliases, unsafe
   * dictionary value types, `object` parameters, filter/map passes, reducer
   * accumulator copies, `Reflect.get` / `Reflect.apply`, and conditional
   * empty-object spreads.
   *
   * Every rule is an error on JS and TS files, outside Markdown code blocks.
   * Turn one off with `rules: { 'quality/no-object-parameters': 'off' }`.
   *
   * @default false
   */
  quality?: boolean
  /**
   * Enable stricter rules that antfu leaves off or loose:
   * `no-promise-executor-return`, `eqeqeq` (`'always'` instead of `'smart'`),
   * `unicorn/prefer-set-has`, `ts/no-confusing-non-null-assertion`
   * (`@typescript-eslint/...` with `canonicalPluginNames`) and
   * `import/no-self-import`. The last comes from `eslint-plugin-import-x`, or
   * from `eslint-plugin-import` with `canonicalPluginNames`.
   *
   * Every rule is an error on JS and TS files, outside Markdown code blocks.
   * A rule is skipped when antfu does not load its plugin (`typescript: false`,
   * `unicorn: false` or `imports: false`). Turn one off with `rules: { eqeqeq: 'off' }`.
   *
   * @default false
   */
  strict?: boolean
}

const { '@typescript-eslint': _ts, 'import-lite': _importLite, ...keptPluginRenaming } = defaultPluginRenaming

/** antfu's renaming, with typescript-eslint back under its own name. */
const canonicalPluginRenaming = {
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

const noSelfImportMerged = new WeakMap<ESLint.Plugin, Promise<ESLint.Plugin>>()

/**
 * Adds `eslint-plugin-import-x`'s `no-self-import` to antfu's import plugin, loading import-x only when needed. Every
 * registration of the same original plugin gets the identical merged object, so ESLint sees one plugin.
 */
function addNoSelfImport(original: ESLint.Plugin): Promise<ESLint.Plugin> {
  const cached = noSelfImportMerged.get(original)
  if (cached) {
    return cached
  }
  const merged = import('eslint-plugin-import-x/rules/no-self-import').then(({ default: rule }: { default: object }): ESLint.Plugin => ({
    ...original,
    // The rule is typed against import-x's own context, which ESLint's plugin type cannot express.
    rules: { ...original.rules, 'no-self-import': rule as NonNullable<ESLint.Plugin['rules']>[string] },
  }))
  noSelfImportMerged.set(original, merged)
  return merged
}

/**
 * The strict resolver fallback: lets the import plugin resolve TypeScript sources through
 * `eslint-import-resolver-typescript` (`.ts` extensions, `.js`-style specifiers that point at `.ts` files, and
 * tsconfig `paths` aliases). Loaded only when `strict` is on.
 */
function resolverConfig(settings: TypedFlatConfigItem['settings']): TypedFlatConfigItem {
  return { name: RESOLVER_NAME, files: [GLOB_SRC], settings }
}

async function typeScriptResolverSettings(): Promise<TypedFlatConfigItem['settings']> {
  const { createTypeScriptImportResolver } = await import('eslint-import-resolver-typescript')
  return { 'import-x/resolver-next': [createTypeScriptImportResolver()] }
}

/**
 * Canonical mode's eslint-plugin-import loads resolvers by name or path relative to the linted file. An absolute path
 * to this package's own copy of the resolver works without hoisting.
 */
function canonicalResolverSettings(): TypedFlatConfigItem['settings'] {
  const resolver = createRequire(import.meta.url).resolve('eslint-import-resolver-typescript')
  return { 'import/resolver': { [resolver]: {} } }
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

/** Adds the opt-in `strict` rules, and the import resolution `import/no-self-import` needs in either plugin mode. */
function addStrict(composer: ReturnType<typeof antfu>, antfuOptions: OptionsConfig, canonicalPluginNames: boolean): void {
  // Mirrors antfu's own defaults for the plugins the rules need.
  const enableImports = antfuOptions.imports !== false
  // antfu registers its import plugin (eslint-plugin-import-lite) as `import`, with or without `autoRenamePlugins`.
  const strictConfigs = strict({
    typescript: !!(antfuOptions.typescript ?? true),
    unicorn: !!(antfuOptions.unicorn ?? true),
    importPlugin: enableImports ? 'import' : false,
  })
  composer.insertBefore('antfu/disables/scripts', strictConfigs)
  composer.onResolved(configs => strictOverrides(configs, antfuOptions))
  if (!enableImports) {
    return
  }
  const resolverKeys = canonicalPluginNames ? ['import/resolver'] : ['import-x/resolver-next', 'import-x/resolver', 'import-x/resolver-legacy', 'import-x/resolve']
  composer.onResolved(configs => yieldImportResolver(configs, resolverKeys))
  // A fallback for consumers who configure no resolver: `yieldImportResolver` drops it entirely once any config sets a resolver setting the active import plugin reads.
  composer.insertBefore('antfu/disables/scripts', canonicalPluginNames ? resolverConfig(canonicalResolverSettings()) : typeScriptResolverSettings().then(resolverConfig))
  if (!canonicalPluginNames) {
    // Canonical mode swaps in eslint-plugin-import, which has the rule natively.
    composer.replacePlugin('import', addNoSelfImport)
  }
}

export function pleaseai(
  options: PleaseaiOptions = {},
  ...userConfigs: TypedFlatConfigItem[]
): ReturnType<typeof antfu> {
  const { canonicalPluginNames = false, formatters, quality: enableQuality = false, strict: enableStrict = false, ...antfuOptions } = options
  const autoRenamePlugins = antfuOptions.autoRenamePlugins ?? true
  const { antfu: antfuFormatters, bun: enableBunFmt } = splitBunFormatter(formatters)
  // The severity moves onto the Markdown and MDX configs: in antfu's files-less `rules` config it would run bun fmt on every file.
  const { 'pleaseai/bun-fmt': bunFmtSeverity, ...otherRules } = antfuOptions.rules ?? {}
  const antfuRules = enableBunFmt ? otherRules : antfuOptions.rules
  const formatterConfigs = enableBunFmt ? bunFmt(antfuOptions.markdown !== false, bunFmtSeverity) : []

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
      formatters: antfuFormatters,
      antislop: resolveAntislop(antfuOptions.antislop),
      rules: {
        'antfu/top-level-function': 'error',
        'test/prefer-lowercase-title': 'off',
        ...antfuRules,
      },
      // antfu's renaming maps `@typescript-eslint` to `ts`, which would undo
      // the rename below for configs that register the canonical name.
      autoRenamePlugins: !canonicalPluginNames && autoRenamePlugins,
    },
    ...formatterConfigs,
    ...userConfigs,
  ).onResolved(scopeAntislopToParsedFiles)

  if (enableQuality) {
    composer.insertBefore('antfu/disables/scripts', quality())
  }

  if (enableStrict) {
    addStrict(composer, antfuOptions, canonicalPluginNames)
  }

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
