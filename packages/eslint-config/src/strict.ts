import type { OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import { getOverrides, GLOB_MARKDOWN_CODE, GLOB_SRC, GLOB_TESTS, GLOB_TS, GLOB_TSX, resolveSubOptions } from '@antfu/eslint-config'

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

type Rules = NonNullable<TypedFlatConfigItem['rules']>

/** The `typescript` options that decide which files antfu's TypeScript configs cover. */
interface TypeScriptScope {
  files?: string[]
  tsconfigPath?: string
  overridesTypeAware?: Rules
  filesTypeAware?: string[]
  ignoresTypeAware?: string[]
}

/** The name strict registers a rule under, for a rule ID spelled the way a consumer might write it. */
export function normalizeRuleId(id: string): string {
  return id.replace(/^@typescript-eslint\//, 'ts/').replace(/^import-lite\//, 'import/')
}

/** Rule IDs the consumer set through antfu's override options that apply to every file strict covers. */
export function unscopedOverriddenRules(options: OptionsConfig): Set<string> {
  const ids = (['javascript', 'unicorn', 'imports'] as const)
    .flatMap(key => Object.keys(getOverrides(options, key)))
  return new Set(ids.map(normalizeRuleId))
}

function pickStrictRules(overrides: Rules, strictIds: ReadonlySet<string>): Rules {
  return Object.fromEntries(Object.entries(overrides).filter(([id]) => strictIds.has(normalizeRuleId(id))))
}

/**
 * antfu applies `typescript`, `typescript.overridesTypeAware` and `test` overrides only to its own file globs, so
 * strict re-applies the consumer's entries for strict rules to those same files, after the strict block.
 */
export function strictScopedOverrides(options: OptionsConfig, strictIds: ReadonlySet<string>): TypedFlatConfigItem[] {
  const configs: TypedFlatConfigItem[] = []
  const add = (name: string, rules: Rules, files: string[], ignores: string[] = []): void => {
    const picked = pickStrictRules(rules, strictIds)
    if (Object.keys(picked).length > 0) {
      configs.push({ name: `pleaseai/strict/${name}`, files, ignores: [GLOB_MARKDOWN_CODE, ...ignores], rules: picked })
    }
  }

  if (options.typescript ?? true) {
    const ts: TypeScriptScope = resolveSubOptions(options, 'typescript')
    const componentExts = [...options.componentExts ?? [], ...options.vue ? ['vue'] : []]
    add('typescript-overrides', getOverrides(options, 'typescript'), ts.files ?? [GLOB_TS, GLOB_TSX, ...componentExts.map(ext => `**/*.${ext}`)])
    if (ts.tsconfigPath) {
      add('typescript-type-aware-overrides', ts.overridesTypeAware ?? {}, ts.filesTypeAware ?? [GLOB_TS, GLOB_TSX], ts.ignoresTypeAware ?? ['**/*.md/**', '**/*.astro/*.ts'])
    }
  }
  if (options.test ?? true) {
    add('test-overrides', getOverrides(options, 'test'), GLOB_TESTS)
  }

  return configs
}
