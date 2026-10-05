import type { ExtractMatch } from './ast-grep.js'
import type { Unit } from './layouts.js'
import type { Finding, Language } from './types.js'
import { isUnder, relativeTo, unitOf } from './layouts.js'
import { nameKey, toKebabCase, toSnakeCase } from './naming.js'

const SLUG = 'code-filename-matches-primary-symbol'

const LANGUAGE_LABEL: Record<FilenameLanguage['language'], string> = { typescript: 'TypeScript', dart: 'Dart' }

/** Display order of the reasons in a notice. */
const OPAQUE_REASONS = ['re-export', 'default export', 'destructured export', 'string-literal export name'] as const
type OpaqueReason = typeof OPAQUE_REASONS[number]

/** Why an opaque-rule match makes the file's exports impossible to enumerate. */
function opaqueReason(m: ExtractMatch): OpaqueReason {
  if (m.ruleId === 'export-destructure') {
    return 'destructured export'
  }
  if (m.ruleId === 'export-directive' || /\bfrom\s*['"`]/.test(m.text) || /^export\s+import\b/.test(m.text)) {
    return 're-export'
  }
  return /^export\s+default\b|\bas\s+default\b|\{\s*default\b/.test(m.text) ? 'default export' : 'string-literal export name'
}

/** Per-language inputs: which files are eligible and how names normalize. */
export interface FilenameLanguage {
  language: Extract<Language, 'typescript' | 'dart'>
  /** Extraction rule ids whose match text is a public top-level name. */
  nameRules: string[]
  /** Rule ids whose presence means the file's exports cannot be enumerated; such files are skipped. */
  opaqueRules?: string[]
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
    opaqueRules: ['export-destructure', 'export-opaque'],
    normalize: toKebabCase,
    isPublic: () => true,
    units,
    stem(file, unit) {
      const name = baseName(file)
      if (!TS_SOURCE.test(name) || /\.d\.[cm]?ts$/.test(name) || underTestRoot(file, unit)) {
        return null
      }
      const stem = name.replace(TS_SOURCE, '')
      // Test files, package entry points, config files, the designated error
      // file (ADR-0022 §1), and framework-dictated route files (Next.js
      // `route`/`middleware`, SvelteKit `+server`) are not named after a symbol.
      if (/\.(?:test|spec)$/.test(stem) || stem === 'index' || stem === 'errors' || stem === 'route' || stem === 'middleware' || stem.startsWith('+') || /\.config(?:\.|$)/.test(stem)) {
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
    opaqueRules: ['export-directive'],
    normalize: toSnakeCase,
    isPublic: name => !name.startsWith('_'),
    units,
    stem(file, unit) {
      const name = baseName(file)
      if (!name.endsWith('.dart') || partFiles.has(file) || underTestRoot(file, unit)) {
        return null
      }
      const rel = unit == null ? file : relativeTo(file, unit.dir)
      // Test drivers and Dart entrypoint directories (`dart run <pkg>:<tool>`).
      if (/^(?:integration_test|test_driver|bin|tool|example|web)\//.test(rel)) {
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
  return inspectFilenames(matches, lang).findings
}

/** Maximum example paths listed in one notice. */
const NOTICE_EXAMPLES = 3

/**
 * Like `checkFilenames`, plus one aggregated notice for the files the check
 * would have judged but skipped because their exports cannot be enumerated.
 * Files exempt by convention (`index.ts`, test files, …) never count.
 */
export function inspectFilenames(matches: ExtractMatch[], lang: FilenameLanguage): { findings: Finding[], notices: string[] } {
  const byFile = new Map<string, Map<string, number>>()
  const opaque = new Map<string, Set<OpaqueReason>>()
  for (const m of matches) {
    if (lang.opaqueRules?.includes(m.ruleId) === true) {
      opaque.set(m.file, (opaque.get(m.file) ?? new Set()).add(opaqueReason(m)))
    }
  }
  // `export { x }` of a name the file imports re-exports it; it is not a local symbol.
  const imported = new Set(matches.filter(m => m.ruleId === 'import-binding').map(m => `${m.file}\0${m.text}`))
  for (const m of matches) {
    if (!lang.nameRules.includes(m.ruleId) || !lang.isPublic(m.text)) {
      continue
    }
    if (imported.has(`${m.file}\0${m.text}`)) {
      opaque.set(m.file, (opaque.get(m.file) ?? new Set()).add('re-export'))
      continue
    }
    const names = byFile.get(m.file) ?? new Map<string, number>()
    if (!names.has(m.text)) {
      names.set(m.text, m.line)
    }
    byFile.set(m.file, names)
  }
  const findings: Finding[] = []
  const skipped = new Map<string, Set<OpaqueReason>>()
  for (const [file, reasons] of opaque) {
    // Two or more enumerated names are never judged anyway; fewer leave the opaque exports as the unknown part.
    if ((byFile.get(file)?.size ?? 0) <= 1 && lang.stem(file, unitOf(file, lang.units)) != null) {
      skipped.set(file, reasons)
    }
  }
  for (const [file, names] of byFile) {
    if (names.size !== 1 || opaque.has(file)) {
      continue
    }
    const stem = lang.stem(file, unitOf(file, lang.units))
    if (stem == null) {
      continue
    }
    const [[symbol, line]] = [...names]
    if (nameKey(stem) === nameKey(symbol)) {
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
  return { findings, notices: skippedNotice(lang, skipped) }
}

function skippedNotice(lang: FilenameLanguage, skipped: Map<string, Set<OpaqueReason>>): string[] {
  if (skipped.size === 0) {
    return []
  }
  const paths = [...skipped.keys()].sort()
  const reasons = OPAQUE_REASONS.filter(r => [...skipped.values()].some(set => set.has(r)))
  const examples = paths.slice(0, NOTICE_EXAMPLES).join(', ')
  return [`${LANGUAGE_LABEL[lang.language]}: filename check skipped ${paths.length} file(s) whose exports cannot be enumerated (${reasons.join(', ')}): ${examples}${paths.length > NOTICE_EXAMPLES ? ', …' : ''}`]
}
