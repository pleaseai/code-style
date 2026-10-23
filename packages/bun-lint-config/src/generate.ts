import type { Linter } from 'eslint'
import { stringify } from 'smol-toml'

export interface BuiltinRule {
  id: string
  aliases: string[]
  on_by_default: boolean
}

export interface BuiltinRules {
  revision: string
  rules: BuiltinRule[]
}

type Severity = 'off' | 'warn' | 'error'
type TomlValue = string | number | boolean | TomlValue[] | { [key: string]: TomlValue }
type RuleEntry = Severity | [Severity, ...TomlValue[]]

interface Override {
  files: string[]
  excludeFiles?: string[]
  rules: Map<string, RuleEntry>
}

const HEADER = `# Generated from @pleaseai/eslint-config by \`bun run generate\` in
# packages/bun-lint-config. Do not edit it by hand.
#
# These are the [lint] tables of a project's bunfig.toml: \`please-style init\`
# writes them there, or copy them in yourself.
`

const SEVERITIES: Severity[] = ['off', 'warn', 'error']

const LINTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']

export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Converts an ESLint (minimatch) glob to Bun.Glob syntax. Bun.Glob has no
 * extglobs: `?(a|b)` becomes `{,a,b}`, and any other extglob throws so a
 * change upstream is noticed instead of silently matching nothing.
 */
export function toBunGlob(glob: string): string {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!
    if (char === '\\') {
      out += glob.slice(i, i + 2)
      i++
      continue
    }
    if ('?*+@!'.includes(char) && glob[i + 1] === '(') {
      const close = glob.indexOf(')', i + 2)
      const body = close === -1 ? '' : glob.slice(i + 2, close)
      if (char !== '?' || close === -1 || body.includes('(')) {
        throw new Error(`Cannot convert the glob "${glob}" to Bun.Glob: only ?(…) extglobs without nesting are supported`)
      }
      out += `{,${body.split('|').join(',')}}`
      i = close
      continue
    }
    out += char
  }
  return out
}

function classEnd(glob: string, start: number): number {
  return glob.indexOf(']', start + 2)
}

export function expandBraces(glob: string): string[] {
  let depth = 0
  let open = -1
  const commas: number[] = []
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    if (char === '\\') {
      i++
    }
    else if (char === '[') {
      i = Math.max(i, classEnd(glob, i))
    }
    else if (char === '{') {
      if (depth++ === 0) {
        open = i
      }
    }
    else if (char === ',' && depth === 1) {
      commas.push(i)
    }
    else if (char === '}' && depth > 0 && --depth === 0) {
      const bounds = [open, ...commas, i]
      const before = glob.slice(0, open)
      const after = glob.slice(i + 1)
      return bounds.slice(1).flatMap((end, n) => expandBraces(`${before}${glob.slice(bounds[n]! + 1, end)}${after}`))
    }
  }
  return [glob]
}

function expandClasses(glob: string): string[] {
  const match = /\[([^\]!^\\-]+)\]/.exec(glob)
  if (match == null) {
    return [glob]
  }
  const before = glob.slice(0, match.index)
  const after = glob.slice(match.index + match[0].length)
  return [...match[1]!].flatMap(char => expandClasses(`${before}${char}${after}`))
}

/**
 * Whether a (converted) glob can match a file `bun lint` reads: some
 * alternative outside a markdown code block (`foo.md/…`, a virtual file of
 * ESLint's markdown processor) whose last segment ends in a linted extension
 * or in `*`.
 */
export function isLintedGlob(glob: string): boolean {
  return expandBraces(glob).flatMap(expandClasses).some((alternative) => {
    if (alternative.includes('.md/')) {
      return false
    }
    const last = alternative.slice(alternative.lastIndexOf('/') + 1)
    return last.endsWith('*') || LINTED_EXTENSIONS.some(ext => last.endsWith(ext))
  })
}

function toGlobs(patterns: unknown[]): string[] {
  return patterns.map((pattern) => {
    if (typeof pattern !== 'string') {
      throw new TypeError(`Cannot convert the files pattern ${JSON.stringify(pattern)}: only string globs are supported`)
    }
    return toBunGlob(pattern)
  })
}

function toToml(value: unknown, rule: string): TomlValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => toToml(item, rule))
  }
  if (typeof value === 'object' && value !== null) {
    const proto = Object.getPrototypeOf(value)
    if (proto === Object.prototype || proto === null) {
      return Object.fromEntries(Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toToml(item, rule)]))
    }
  }
  throw new TypeError(`The options of "${rule}" cannot be written as TOML: ${String(value)}`)
}

function toSeverity(severity: unknown, rule: string): Severity {
  if (typeof severity === 'number' && SEVERITIES[severity] !== undefined) {
    return SEVERITIES[severity]
  }
  if (SEVERITIES.includes(severity as Severity)) {
    return severity as Severity
  }
  throw new TypeError(`"${rule}" has an invalid severity: ${String(severity)}`)
}

function toEntry(entry: unknown, rule: string): RuleEntry {
  if (!Array.isArray(entry)) {
    return toSeverity(entry, rule)
  }
  const [severity, ...options] = entry
  return options.length === 0
    ? toSeverity(severity, rule)
    : [toSeverity(severity, rule), ...options.map(option => toToml(option, rule))]
}

const severityOf = (entry: RuleEntry): Severity => typeof entry === 'string' ? entry : entry[0]

/** ESLint keeps the options of the previous entry when a later one sets only the severity. */
function withOptions(entry: RuleEntry, previous: RuleEntry | undefined): RuleEntry {
  return typeof entry === 'string' && Array.isArray(previous) ? [entry, ...previous.slice(1)] : entry
}

function isGlobalIgnores(item: Linter.Config): boolean {
  return item.ignores != null && Object.keys(item).every(key => key === 'ignores' || key === 'name')
}

function sortedRules(rules: Map<string, RuleEntry>): Record<string, RuleEntry> {
  return Object.fromEntries([...rules].sort(([a], [b]) => compareIds(a, b)))
}

/**
 * Maps resolved ESLint flat configs to the `[lint]` tables of a bunfig.toml,
 * keeping only the rules in `builtinRules` and the files `bun lint` reads.
 * Flat-config order is kept: global rules go to `[lint.rules]` (and win over
 * earlier file-scoped settings), file-scoped ones to `[[lint.overrides]]`.
 */
export function generateLintToml(configs: Linter.Config[], builtinRules: BuiltinRules): string {
  const onByDefault = new Map<string, boolean>()
  for (const rule of builtinRules.rules) {
    for (const id of [rule.id, ...rule.aliases]) {
      onByDefault.set(id, rule.on_by_default)
    }
  }

  const ignorePatterns = new Set<string>()
  const base = new Map<string, RuleEntry>()
  let overrides: Override[] = []

  for (const item of configs) {
    if (isGlobalIgnores(item)) {
      // ignorePatterns are .gitignore lines, which have no braces.
      for (const glob of toGlobs(item.ignores!)) {
        expandBraces(glob).forEach(pattern => ignorePatterns.add(pattern))
      }
      continue
    }
    const rules = new Map<string, RuleEntry>()
    for (const [rule, entry] of Object.entries(item.rules ?? {})) {
      if (entry !== undefined && onByDefault.has(rule)) {
        rules.set(rule, toEntry(entry, rule))
      }
    }
    if (rules.size === 0) {
      continue
    }

    const excludeFiles = item.ignores == null ? [] : toGlobs(item.ignores)
    let files: string[] | undefined
    if (item.files != null) {
      files = toGlobs(item.files).filter(isLintedGlob)
      if (files.length === 0) {
        continue
      }
    }
    else if (excludeFiles.some(isLintedGlob)) {
      files = ['**/*']
    }

    if (files == null) {
      // [lint.rules] comes before every override, so an override's options
      // for its files survive this entry only when it sets just the severity.
      for (const [rule, entry] of rules) {
        base.set(rule, withOptions(entry, base.get(rule)))
        for (const override of overrides) {
          const previous = override.rules.get(rule)
          if (typeof entry === 'string' && Array.isArray(previous)) {
            override.rules.set(rule, withOptions(entry, previous))
          }
          else {
            override.rules.delete(rule)
          }
        }
      }
      overrides = overrides.filter(override => override.rules.size > 0)
      continue
    }
    // Severity-only entries stay that way: `bun lint` resolves their options
    // per file from the earlier matching entries, as ESLint does.
    overrides.push({ files, ...(excludeFiles.length > 0 ? { excludeFiles } : {}), rules })
  }

  const turnedOn = new Set<string>()
  const prune = (rules: Map<string, RuleEntry>, later: Override[]): void => {
    for (const [rule, entry] of rules) {
      if (severityOf(entry) !== 'off') {
        turnedOn.add(rule)
      }
      else if (Array.isArray(entry) && later.some(override => typeof override.rules.get(rule) === 'string')) {
        continue
      }
      else if (onByDefault.get(rule) || turnedOn.has(rule)) {
        rules.set(rule, 'off')
      }
      else {
        rules.delete(rule)
      }
    }
  }
  prune(base, overrides)
  overrides.forEach((override, i) => prune(override.rules, overrides.slice(i + 1)))

  const lint: Record<string, unknown> = {}
  if (ignorePatterns.size > 0) {
    lint.ignorePatterns = [...ignorePatterns]
  }
  lint.rules = sortedRules(base)
  lint.overrides = overrides
    .filter(override => override.rules.size > 0)
    .map(({ rules, ...override }) => ({ ...override, rules: sortedRules(rules) }))
  return `${HEADER}\n${stringify({ lint })}`
}
