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

type Rules = NonNullable<TypedFlatConfigItem['rules']>

const STRICT_NAME = 'pleaseai/strict/rules'

/** Name of the fallback config that gives import-x or eslint-plugin-import a TypeScript resolver. */
export const RESOLVER_NAME = 'pleaseai/strict/import-resolver'

/** Rules that antfu leaves off or loose, at `'error'`. A rule is left out when antfu does not load its plugin. */
export function strict(options: StrictOptions): TypedFlatConfigItem[] {
  const rules: Rules = {
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

/** The name strict registers a rule under, for a rule ID spelled the way a consumer might write it. */
function normalizeRuleId(id: string): string {
  return id.replace(/^@typescript-eslint\//, 'ts/').replace(/^import-lite\//, 'import/')
}

function isRecord(value: unknown): value is { overrides?: unknown, overridesTypeAware?: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface OverrideEntry {
  /** The antfu option group the override was given under; antfu applies it to configs named `antfu/<group>/...`. */
  group: string
  id: string
  value: unknown
}

interface OverrideMap {
  group: string
  map: Rules
}

/** Every override map the consumer gave antfu, with its option group: each group's `overrides` / `overridesTypeAware`, and the deprecated `overrides.<group>`. */
function overrideMaps(options: OptionsConfig): OverrideMap[] {
  const maps = (group: string, ...candidates: unknown[]): OverrideMap[] =>
    candidates.flatMap(map => isRecord(map) ? [{ group, map: map as Rules }] : [])
  return Object.entries(options).flatMap(([key, value]) => {
    if (key === 'overrides' && isRecord(value)) {
      return Object.entries(value).flatMap(([group, map]) => maps(group, map))
    }
    return isRecord(value) ? maps(key, value.overrides, value.overridesTypeAware) : []
  })
}

/** The strict-owned entries of the consumer's override maps, with normalized rule IDs. */
function strictOverrideEntries(options: OptionsConfig, strictIds: ReadonlySet<string>): OverrideEntry[] {
  return overrideMaps(options)
    .flatMap(({ group, map }) => Object.entries(map).map(([id, value]): OverrideEntry => ({ group, id: normalizeRuleId(id), value })))
    .filter(entry => strictIds.has(entry.id))
}

/** The rules of `source` that hold one of the consumer's override entries for a group that generated `source`, i.e. what antfu applied the override to. */
function appliedRules(source: TypedFlatConfigItem, entries: OverrideEntry[]): Rules {
  const name = source.name ?? ''
  const own = entries.filter(entry => name.startsWith(`antfu/${entry.group}/`))
  return Object.fromEntries(Object.entries(source.rules ?? {}).filter(([id, value]) => {
    const normalized = normalizeRuleId(id)
    return own.some(entry => entry.id === normalized && isDeepStrictEqual(entry.value, value))
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
  if (entries.length === 0) {
    return configs
  }
  const reapplied = configs.slice(0, strictIndex).flatMap((source): TypedFlatConfigItem[] => {
    const rules = appliedRules(source, entries)
    return Object.keys(rules).length > 0
      ? [{
          name: `pleaseai/strict/overrides/${source.name ?? 'unnamed'}`,
          files: source.files ?? [GLOB_SRC],
          ignores: [GLOB_MARKDOWN_CODE, ...source.ignores ?? []],
          rules,
        }]
      : []
  })
  return [...configs.slice(0, strictIndex + 1), ...reapplied, ...configs.slice(strictIndex + 1)]
}

function setsResolver({ name, settings }: TypedFlatConfigItem, keys: readonly string[]): boolean {
  return name !== RESOLVER_NAME && settings !== undefined && keys.some(key => key in settings)
}

/**
 * The strict resolver config is a fallback for projects that configure no resolver. Run on the resolved configs, with
 * `keys` the resolver settings the active import plugin reads (other resolver settings do not count). Once any other
 * config sets one of them, the config is removed and the consumer owns resolution for every file, whatever that
 * config's `files`, `ignores` or `basePath`.
 */
export function yieldImportResolver(configs: TypedFlatConfigItem[], keys: readonly string[]): TypedFlatConfigItem[] {
  return configs.some(config => setsResolver(config, keys))
    ? configs.filter(config => config.name !== RESOLVER_NAME)
    : configs
}
