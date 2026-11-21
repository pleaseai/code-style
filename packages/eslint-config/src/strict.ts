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

interface OverrideEntry {
  /** The antfu option group the override was given under; antfu applies it to configs named `antfu/<group>/...`. */
  group: string
  id: string
  value: unknown
}

/** Every override map the consumer gave antfu, with its option group: each group's `overrides` / `overridesTypeAware`, and the deprecated `overrides.<group>`. */
function overrideMaps(options: OptionsConfig): { group: string, map: Rules }[] {
  const maps: { group: string, map: unknown }[] = []
  for (const [key, value] of Object.entries(options)) {
    if (key === 'overrides' && isRecord(value)) {
      maps.push(...Object.entries(value).map(([group, map]) => ({ group, map })))
    }
    else if (isRecord(value)) {
      maps.push({ group: key, map: value.overrides }, { group: key, map: value.overridesTypeAware })
    }
  }
  return maps.filter(entry => isRecord(entry.map)) as { group: string, map: Rules }[]
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
  const reapplied: TypedFlatConfigItem[] = []
  for (const source of configs.slice(0, strictIndex)) {
    const rules = appliedRules(source, entries)
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

const RESOLVER_NAME = 'pleaseai/strict/import-resolver'

function setsResolver(config: TypedFlatConfigItem, keys: readonly string[]): boolean {
  return config.name !== RESOLVER_NAME && keys.some(key => config.settings !== undefined && key in config.settings)
}

const isPlainGlob = (file: unknown): file is string => typeof file === 'string' && !file.startsWith('!')

/** A consumer resolver config whose scope is plain `files` / `ignores` globs, so the fallback can step aside for exactly the files it covers. */
function hasExpressibleScope(config: TypedFlatConfigItem): boolean {
  return config.basePath === undefined
    && (config.files ?? []).every(isPlainGlob)
    && (config.ignores ?? []).every(isPlainGlob)
}

const filesOf = (config: TypedFlatConfigItem): string[] => (config.files ?? []) as string[]

/**
 * A fallback for the files a consumer resolver config skips through its own `ignores`: they match the fallback's files,
 * the consumer's `files` and one of the consumer's `ignores`, and never a file another consumer resolver config covers.
 */
function ignoredFilesFallback(fallback: TypedFlatConfigItem, consumers: TypedFlatConfigItem[], index: number): TypedFlatConfigItem {
  const consumer = consumers[index]!
  const scope = consumer.files ? filesOf(consumer) : [undefined]
  const others = consumers.filter((_, i) => i !== index).flatMap(filesOf)
  const markdown = fallback.ignores?.includes(GLOB_MARKDOWN_CODE) ? [GLOB_MARKDOWN_CODE] : []
  return {
    ...fallback,
    name: `${RESOLVER_NAME}/${consumer.name ?? index}`,
    files: scope.flatMap(file => (consumer.ignores ?? []).map(ignore => [GLOB_SRC, ...file ? [file] : [], ignore])),
    ignores: [...others, ...markdown],
  }
}

/**
 * The strict resolver config is a fallback for consumers who configure no resolver. Run on the resolved configs, with
 * `keys` the resolver settings the active import plugin reads (other resolver settings do not count). It drops the
 * fallback when a consumer resolver config covers every file or has a scope that globs cannot express (`basePath`, negated
 * or non-string `files`, negated `ignores`). Otherwise it excludes the files each consumer resolver config's `files`
 * cover, and adds a fallback for the files a consumer's own `ignores` skip, so the consumer resolver owns exactly its files.
 */
export function yieldImportResolver(configs: TypedFlatConfigItem[], keys: readonly string[]): TypedFlatConfigItem[] {
  const index = configs.findIndex(config => config.name === RESOLVER_NAME)
  const consumers = configs.filter(config => setsResolver(config, keys))
  if (index === -1 || consumers.length === 0) {
    return configs
  }
  const fallback = configs[index]!
  const extras = consumers.flatMap((consumer, i) => consumer.ignores?.length ? [ignoredFilesFallback(fallback, consumers, i)] : [])
  const covered = consumers.flatMap(filesOf)
  const global = consumers.some(consumer => !consumer.files)
  const base = !global && consumers.every(hasExpressibleScope) ? [{ ...fallback, ignores: [...fallback.ignores ?? [], ...covered] }] : []
  const replacement = consumers.every(hasExpressibleScope) ? [...base, ...extras] : []
  return configs.flatMap((config, i) => i === index ? replacement : [config])
}
