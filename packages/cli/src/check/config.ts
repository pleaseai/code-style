import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ConfigError } from './errors.js'

/** Optional config file, looked up in the checked root and in each package directory. */
export const CONFIG_FILE = 'code-organization.json'

/**
 * Environment segments allowed directly under a test root (ADR-0022 §3,
 * following the Nuxt testing docs). `e2e` is special: tests under it have no
 * source counterpart, so their path is not derived.
 */
export const DEFAULT_ENV_SEGMENTS: readonly string[] = ['unit', 'nuxt', 'browser', 'e2e']

/** Segments whose tests are never derived (no target source file). */
export const E2E_SEGMENTS: readonly string[] = ['e2e']

/**
 * The config can only *add* names within the standard's shape: extra source
 * roots and extra environment segments. There is deliberately no key that
 * moves tests out of the test root or turns a rule off (ADR-0022
 * Consequences: no opt-out to colocated tests).
 */
export interface CodeOrganizationConfig {
  sourceRoots: string[]
  envSegments: string[]
  /** Set when the base came from `--config`: the root `code-organization.json` is then not read. */
  explicit?: boolean
}

const ALLOWED_KEYS = new Set(['$schema', 'sourceRoots', 'envSegments'])

function readNames(value: unknown, key: string, file: string, allowNested: boolean): string[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new ConfigError(`${file}: "${key}" must be an array of strings`)
  }
  return value.map((item) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new ConfigError(`${file}: "${key}" entries must be non-empty strings`)
    }
    const name = item.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
    const segments = name.split('/')
    if (name.startsWith('/') || segments.includes('..') || segments.includes('.') || name === '') {
      throw new ConfigError(`${file}: "${key}" entry "${item}" must be a relative path inside the package`)
    }
    if (!allowNested && segments.length > 1) {
      throw new ConfigError(`${file}: "${key}" entry "${item}" must be a single directory name`)
    }
    return name
  })
}

/** Parses one config file. Returns empty additions when the file does not exist. */
export function readConfigFile(file: string): CodeOrganizationConfig {
  if (!existsSync(file)) {
    return { sourceRoots: [], envSegments: [] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf-8'))
  }
  catch (err) {
    throw new ConfigError(`${file}: invalid JSON (${err instanceof Error ? err.message : String(err)})`)
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ConfigError(`${file}: expected a JSON object`)
  }
  const record = raw as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new ConfigError(`${file}: unknown key "${key}" (allowed: sourceRoots, envSegments)`)
    }
  }
  return {
    sourceRoots: readNames(record.sourceRoots, 'sourceRoots', file, true),
    envSegments: readNames(record.envSegments, 'envSegments', file, false),
  }
}

/** Merges additions; later configs only ever add names. */
export function mergeConfigs(...configs: CodeOrganizationConfig[]): CodeOrganizationConfig {
  return {
    sourceRoots: [...new Set(configs.flatMap(c => c.sourceRoots))],
    envSegments: [...new Set(configs.flatMap(c => c.envSegments))],
  }
}

/** Config for one package: root config (or `--config`) plus the package's own file. */
export function packageConfig(base: CodeOrganizationConfig, packageDir: string): CodeOrganizationConfig {
  return mergeConfigs(base, readConfigFile(join(packageDir, CONFIG_FILE)))
}
