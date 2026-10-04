import type { ExtractMatch } from './ast-grep.js'
import type { Unit } from './layouts.js'
import type { Finding, Language } from './types.js'
import { isUnder, relativeTo, unitOf } from './layouts.js'
import { toKebabCase, toSnakeCase } from './naming.js'

const SLUG = 'code-filename-matches-primary-symbol'

/** Per-language inputs: which files are eligible and how names normalize. */
export interface FilenameLanguage {
  language: Extract<Language, 'typescript' | 'dart'>
  /** Extraction rule ids whose match text is a public top-level name. */
  nameRules: string[]
  normalize: (name: string) => string
  isPublic: (name: string) => boolean
  /** File name without extension, or `null` when the file is exempt. */
  stem: (file: string, unit: Unit | undefined) => string | null
  units: Unit[]
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function underTestRoot(file: string, unit: Unit | undefined): boolean {
  if (unit == null) {
    return false
  }
  const rel = relativeTo(file, unit.dir)
  return unit.testRoots.some(root => isUnder(rel, root))
}

const TS_SOURCE = /\.(?:ts|tsx|mts|cts)$/

export function typescriptFilenames(units: Unit[]): FilenameLanguage {
  return {
    language: 'typescript',
    nameRules: ['export-name'],
    normalize: toKebabCase,
    isPublic: () => true,
    units,
    stem(file, unit) {
      const name = baseName(file)
      if (!TS_SOURCE.test(name) || name.endsWith('.d.ts') || underTestRoot(file, unit)) {
        return null
      }
      const stem = name.replace(TS_SOURCE, '')
      // Test files, package entry points, config files, and the designated
      // error file (ADR-0022 §1) are not named after a symbol.
      if (/\.(?:test|spec)$/.test(stem) || stem === 'index' || stem === 'errors' || /\.config(?:\.|$)/.test(stem)) {
        return null
      }
      return stem
    },
  }
}

export function dartFilenames(units: Unit[], partFiles: Set<string>): FilenameLanguage {
  return {
    language: 'dart',
    nameRules: ['top-level-name', 'top-level-type-alias'],
    normalize: toSnakeCase,
    isPublic: name => !name.startsWith('_'),
    units,
    stem(file, unit) {
      const name = baseName(file)
      if (!name.endsWith('.dart') || partFiles.has(file) || underTestRoot(file, unit)) {
        return null
      }
      const rel = unit == null ? file : relativeTo(file, unit.dir)
      if (/^(?:integration_test|test_driver)\//.test(rel)) {
        return null
      }
      const stem = name.slice(0, -'.dart'.length)
      // `_test.dart`, the error file, and generated `*.g.dart`/`*.freezed.dart`.
      if (stem.endsWith('_test') || stem === 'errors' || stem.includes('.')) {
        return null
      }
      return stem
    },
  }
}

/**
 * `code-filename-matches-primary-symbol`: a file with exactly one public
 * top-level symbol is named after it, compared after normalizing both names
 * with the language's file-naming convention.
 */
export function checkFilenames(matches: ExtractMatch[], lang: FilenameLanguage): Finding[] {
  const byFile = new Map<string, Map<string, number>>()
  for (const m of matches) {
    if (!lang.nameRules.includes(m.ruleId) || !lang.isPublic(m.text)) {
      continue
    }
    const names = byFile.get(m.file) ?? new Map<string, number>()
    if (!names.has(m.text)) {
      names.set(m.text, m.line)
    }
    byFile.set(m.file, names)
  }
  const findings: Finding[] = []
  for (const [file, names] of byFile) {
    if (names.size !== 1) {
      continue
    }
    const stem = lang.stem(file, unitOf(file, lang.units))
    if (stem == null) {
      continue
    }
    const [[symbol, line]] = [...names]
    if (lang.normalize(stem) === lang.normalize(symbol)) {
      continue
    }
    const ext = baseName(file).slice(stem.length)
    findings.push({
      slug: SLUG,
      kind: 'filename-mismatch',
      severity: 'warning',
      language: lang.language,
      file,
      line,
      message: `File name does not match its only public symbol \`${symbol}\`. Rename the file to \`${lang.normalize(symbol)}${ext}\`, or rename the symbol after the file.`,
    })
  }
  return findings
}
