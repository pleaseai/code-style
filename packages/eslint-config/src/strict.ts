import type { OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import { isDeepStrictEqual } from 'node:util'
import { GLOB_MARKDOWN_CODE, GLOB_SRC } from '@antfu/eslint-config'

export interface StrictOptions {
  /** Whether antfu loads the `ts` plugin. */
  typescript: boolean
  /** Whether antfu loads the `unicorn` plugin. */
  unicorn: boolean
  /** Name the import plugin is registered under, or `false` when antfu does not load it. */
  importPlugin: string | false
}

const STRICT_NAME = 'pleaseai/strict/rules'

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

  return [
    {
      name: STRICT_NAME,
      files: [GLOB_SRC],
      ignores: [GLOB_MARKDOWN_CODE],
      rules,
    },
  ]
}

type Rules = NonNullable<TypedFlatConfigItem['rules']>

/** The name strict registers a rule under, for a rule ID spelled the way a consumer might write it. */
export function normalizeRuleId(id: string): string {
  return id.replace(/^@typescript-eslint\//, 'ts/').replace(/^import-lite\//, 'import/')
}

function isRecord(value: unknown): value is { overrides?: unknown, overridesTypeAware?: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Every override map the consumer gave antfu: each option group's `overrides` / `overridesTypeAware`, and the deprecated `overrides.<group>`. */
function overrideMaps(options: OptionsConfig): Rules[] {
  const maps: unknown[] = []
  for (const [key, value] of Object.entries(options)) {
    if (key === 'overrides' && isRecord(value)) {
      maps.push(...Object.values(value))
    }
    else if (isRecord(value)) {
      maps.push(value.overrides, value.overridesTypeAware)
    }
  }
  return maps.filter(isRecord) as Rules[]
}

/** The strict-owned entries of the consumer's override maps, keyed by normalized rule ID. */
function strictOverrideEntries(options: OptionsConfig, strictIds: ReadonlySet<string>): [string, unknown][] {
  return overrideMaps(options)
    .flatMap(map => Object.entries(map))
    .map(([id, value]): [string, unknown] => [normalizeRuleId(id), value])
    .filter(([id]) => strictIds.has(id))
}

/** The rules of `source` that hold one of the consumer's override entries, i.e. what antfu applied the override to. */
function appliedRules(source: Rules, entries: [string, unknown][]): Rules {
  return Object.fromEntries(Object.entries(source).filter(([id, value]) => {
    const normalized = normalizeRuleId(id)
    return entries.some(([entryId, entryValue]) => entryId === normalized && isDeepStrictEqual(entryValue, value))
  }))
}

/**
 * antfu applies each option group's `overrides` to that group's own configs and files, before the strict block. For
 * every config that took one of the consumer's overrides for a strict rule, re-applies it right after the strict block
 * on that config's files, so the override still wins but only where antfu applied it. Run on the resolved configs.
 */
export function strictOverrides(configs: TypedFlatConfigItem[], options: OptionsConfig): TypedFlatConfigItem[] {
  const strictIndex = configs.findIndex(config => config.name === STRICT_NAME)
  if (strictIndex === -1) {
    return configs
  }
  const strictIds = new Set(Object.keys(configs[strictIndex]!.rules ?? {}).map(normalizeRuleId))
  const entries = strictOverrideEntries(options, strictIds)
  const reapplied: TypedFlatConfigItem[] = []
  for (const source of configs.slice(0, strictIndex)) {
    const rules = appliedRules(source.rules ?? {}, entries)
    if (Object.keys(rules).length > 0) {
      reapplied.push({
        name: `pleaseai/strict/overrides/${source.name ?? 'unnamed'}`,
        files: source.files ?? [GLOB_SRC],
        ignores: [GLOB_MARKDOWN_CODE, ...source.ignores ?? []],
        rules,
      })
    }
  }
  return [...configs.slice(0, strictIndex + 1), ...reapplied, ...configs.slice(strictIndex + 1)]
}
