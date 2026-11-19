import type { OptionsAntislop, OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import type { Linter } from 'eslint'
import { GLOB_MARKDOWN, GLOB_SRC, isPackageInScope } from '@antfu/eslint-config'

type AntislopOption = OptionsConfig['antislop']
type Rules = Record<string, Linter.RuleEntry | undefined>

const SLOP = 'eslint-plugin-slop'
const SONARJS = 'eslint-plugin-sonarjs'

function pluginsOf({ slop, sonarjs }: OptionsAntislop): string[] {
  return [slop !== false && SLOP, sonarjs !== false && SONARJS].filter(name => name !== false)
}

export function resolveAntislop(
  option: AntislopOption,
  isInstalled: (name: string) => boolean = isPackageInScope,
): AntislopOption {
  if (option === false) {
    return false
  }
  const settings: OptionsAntislop = option === true ? { slop: true, sonarjs: true } : option ?? {}
  const {
    slop = isInstalled(SLOP),
    sonarjs = typeof settings.cognitiveComplexity === 'number' || isInstalled(SONARJS),
  } = settings
  const enabled = pluginsOf({ slop, sonarjs })
  if (enabled.length === 0) {
    return false
  }
  const missing = enabled.filter(name => !isInstalled(name))
  if (missing.length > 0) {
    throw new Error(
      `\`antislop\` requires ${missing.map(name => `\`${name}\``).join(' and ')}. `
      + `Install with \`bun add -D ${missing.join(' ')}\`, or set \`antislop: false\`.`,
    )
  }
  return option === undefined ? { slop, sonarjs } : { ...settings, slop, sonarjs }
}

function isOff(severity: Linter.RuleEntry): boolean {
  return severity === 'off' || severity === 0
}

function toWarning(entry: Linter.RuleEntry | undefined): Linter.RuleEntry | undefined {
  if (Array.isArray(entry)) {
    const [severity, ...rest] = entry
    return isOff(severity) ? entry : ['warn', ...rest]
  }
  return entry === undefined || isOff(entry) ? entry : 'warn'
}

function asWarnings(rules: Rules = {}): Rules {
  return Object.fromEntries(Object.entries(rules).map(([id, entry]) => [id, toWarning(entry)]))
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
export function scopeAntislopToParsedFiles(configs: TypedFlatConfigItem[]): TypedFlatConfigItem[] {
  const universal = configs.find(config => config.name === 'antfu/antislop/rules/universal')
  if (!universal?.files) {
    return configs
  }
  const languages = universal.files.filter(glob => glob !== GLOB_SRC)
  const groups = [
    {
      name: 'pleaseai/antislop/rules/parsed',
      globs: languages.filter(glob => glob !== GLOB_MARKDOWN),
      rules: universal.rules,
    },
    {
      name: 'pleaseai/antislop/rules/markdown',
      globs: languages.filter(glob => glob === GLOB_MARKDOWN),
      rules: asWarnings(universal.rules),
    },
  ].filter(group => group.globs.length > 0)
  const parsed = configs.flatMap((config) => {
    const { basePath, files, ignores, language, languageOptions } = config
    if (config === universal || !files || !(languageOptions?.parser || language)) {
      return []
    }
    return groups.map(({ name, globs, rules }) => ({
      name,
      ...(basePath ? { basePath } : {}),
      files: files.flatMap(pattern => globs.map(glob => [pattern, glob].flat())),
      ignores: [...(ignores ?? []), ...(universal.ignores ?? [])],
      rules,
    }))
  })
  universal.files = universal.files.filter(glob => glob === GLOB_SRC)
  const index = configs.indexOf(universal)
  return [...configs.slice(0, index + 1), ...parsed, ...configs.slice(index + 1)]
}
