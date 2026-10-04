import type { ExtractMatch } from './ast-grep.js'
import type { TestLayout, Unit } from './layouts.js'
import type { Finding, Language } from './types.js'
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { isUnder, joinPath, relativeTo, unitOf } from './layouts.js'

const SLUG = 'test-helpers-in-dedicated-location'

/** Helper-candidate names (ADR-0022 §3, after Factory `test-utils-organization`). */
export const HELPER_NAME = /^(?:[cC]reateMock|[mM]ock|[fF]ake|[sS]tub)(?:[A-Z0-9_$]|$)/

interface Candidate {
  file: string
  line: number
  name: string
}

/** Language inputs for the shared-helper check. */
export interface HelperLanguage {
  language: Extract<Language, 'typescript' | 'dart' | 'kotlin' | 'java'>
  layout: TestLayout
  units: Unit[]
  /** Candidates declared in test-side files. */
  candidates: Candidate[]
  /** Test files that import `candidate` (resolved the language's way). */
  importers: (candidate: Candidate) => Set<string>
}

function inDesignatedLocation(file: string, lang: HelperLanguage): boolean {
  const unit = unitOf(file, lang.units)
  if (unit == null) {
    return false
  }
  const rel = relativeTo(file, unit.dir)
  return lang.layout.helperDirs(unit).some(dir => isUnder(rel, dir))
}

function isTestSide(file: string, lang: HelperLanguage, roots: (unit: Unit) => string[]): boolean {
  if (lang.layout.isTestFile(file)) {
    return true
  }
  const unit = unitOf(file, lang.units)
  return unit != null && roots(unit).some(root => isUnder(relativeTo(file, unit.dir), root))
}

/** The designated helper dir under the candidate's own test root, else the first one. */
function suggestedDir(lang: HelperLanguage, unit: Unit, file: string): string {
  const dirs = lang.layout.helperDirs(unit)
  const rel = relativeTo(file, unit.dir)
  const own = dirs.find(d => isUnder(rel, posix.dirname(d))) ?? dirs[0]
  return `${joinPath(unit.dir, own)}/`
}

/**
 * `test-helpers-in-dedicated-location`: a helper candidate declared outside
 * the designated location is reported only when two or more test files import
 * it. A helper used by a single test file is local and never reported.
 */
export function checkHelpers(lang: HelperLanguage): Finding[] {
  const findings: Finding[] = []
  for (const candidate of lang.candidates) {
    if (inDesignatedLocation(candidate.file, lang)) {
      continue
    }
    const importers = lang.importers(candidate)
    importers.delete(candidate.file)
    if (importers.size < 2) {
      continue
    }
    const unit = unitOf(candidate.file, lang.units)
    const target = unit == null ? '' : suggestedDir(lang, unit, candidate.file)
    findings.push({
      slug: SLUG,
      kind: 'shared-helper-outside-location',
      severity: 'warning',
      language: lang.language,
      file: candidate.file,
      line: candidate.line,
      message: `Shared test helper \`${candidate.name}\` is imported by ${importers.size} test files (${[...importers].sort().slice(0, 3).join(', ')}) but declared outside ${target}. Move it there.`,
    })
  }
  return findings
}

// --- TypeScript -------------------------------------------------------------

function unquote(text: string): string {
  return text.replace(/^['"`]|['"`]$/g, '')
}

function resolveRelative(importer: string, spec: string, fileSet: Set<string>, exts: string[]): string | undefined {
  if (!spec.startsWith('.')) {
    return undefined
  }
  const base = posix.normalize(posix.join(posix.dirname(importer), spec))
  // `./helpers.js` written for ESM resolution may point at `helpers.ts`.
  const stripped = base.replace(/\.[cm]?js$/, '')
  const options = [base, ...exts.map(e => `${stripped}${e}`), ...exts.map(e => `${stripped}/index${e}`)]
  return options.find(o => fileSet.has(o))
}

export function typescriptHelpers(
  layout: TestLayout,
  units: Unit[],
  matches: ExtractMatch[],
  fileSet: Set<string>,
): HelperLanguage {
  const lang: HelperLanguage = { language: 'typescript', layout, units, candidates: [], importers: () => new Set() }
  lang.candidates = matches
    .filter(m => m.ruleId === 'helper-candidate' && isTestSide(m.file, lang, u => u.testRoots))
    .map(m => ({ file: m.file, line: m.line, name: m.text }))
  // target file → name (or `*` for a namespace import) → importing test files
  const imports = new Map<string, Map<string, Set<string>>>()
  for (const m of matches) {
    if ((m.ruleId !== 'import-name' && m.ruleId !== 'import-namespace') || !layout.isTestFile(m.file)) {
      continue
    }
    const target = resolveRelative(m.file, unquote(m.vars.SRC ?? ''), fileSet, layout.sourceExtensions)
    if (target == null) {
      continue
    }
    const name = m.ruleId === 'import-namespace' ? '*' : m.text
    const byName = imports.get(target) ?? new Map<string, Set<string>>()
    const set = byName.get(name) ?? new Set<string>()
    set.add(m.file)
    byName.set(name, set)
    imports.set(target, byName)
  }
  lang.importers = (c) => {
    const byName = imports.get(c.file)
    return new Set([...(byName?.get(c.name) ?? []), ...(byName?.get('*') ?? [])])
  }
  return lang
}

// --- Dart -------------------------------------------------------------------

export function dartHelpers(
  layout: TestLayout,
  units: Unit[],
  matches: ExtractMatch[],
  fileSet: Set<string>,
): HelperLanguage {
  const lang: HelperLanguage = { language: 'dart', layout, units, candidates: [], importers: () => new Set() }
  lang.candidates = matches
    .filter(m => m.ruleId === 'top-level-name' && HELPER_NAME.test(m.text) && isTestSide(m.file, lang, u => u.testRoots))
    .map(m => ({ file: m.file, line: m.line, name: m.text }))
  // `show` lists per (importer, uri text); an import without `show` imports everything.
  const shown = new Map<string, Set<string>>()
  for (const m of matches) {
    if (m.ruleId === 'import-show') {
      const key = `${m.file}\0${m.vars.SRC ?? ''}`
      shown.set(key, (shown.get(key) ?? new Set()).add(m.text))
    }
  }
  const hidden = new Map<string, Set<string>>()
  for (const m of matches) {
    if (m.ruleId === 'import-hide') {
      const key = `${m.file}\0${m.vars.SRC ?? ''}`
      hidden.set(key, (hidden.get(key) ?? new Set()).add(m.text))
    }
  }
  const imports = new Map<string, Array<{ importer: string, names: Set<string> | null, hides: Set<string> }>>()
  for (const m of matches) {
    if (m.ruleId !== 'import-uri' || !layout.isTestFile(m.file)) {
      continue
    }
    const uri = unquote(m.text)
    const target = uri.startsWith('package:') || uri.startsWith('dart:')
      ? undefined
      : resolveRelative(m.file, uri.startsWith('.') ? uri : `./${uri}`, fileSet, [])
    if (target == null) {
      continue
    }
    const list = imports.get(target) ?? []
    const key = `${m.file}\0${m.text}`
    list.push({ importer: m.file, names: shown.get(key) ?? null, hides: hidden.get(key) ?? new Set() })
    imports.set(target, list)
  }
  lang.importers = c => new Set(
    (imports.get(c.file) ?? []).filter(i => (i.names == null || i.names.has(c.name)) && !i.hides.has(c.name)).map(i => i.importer),
  )
  return lang
}

// --- Kotlin / Java ----------------------------------------------------------

export function jvmHelpers(
  layout: TestLayout,
  units: Unit[],
  matches: ExtractMatch[],
  files: string[],
  rootDir: string,
): HelperLanguage {
  const language = layout.language as 'kotlin' | 'java'
  const lang: HelperLanguage = { language, layout, units, candidates: [], importers: () => new Set() }
  const sourceSets = (u: Unit): string[] => [`src/test/${language}`, `src/testFixtures/${language}`].filter(s => s !== u.sourceRoots[0])
  lang.candidates = matches
    .filter(m => m.ruleId === 'helper-candidate' && isTestSide(m.file, lang, sourceSets))
    .map(m => ({ file: m.file, line: m.line, name: m.text }))
  const packageOf = new Map<string, string>()
  const importsOf = new Map<string, string[]>()
  for (const m of matches) {
    if (m.ruleId === 'package') {
      packageOf.set(m.file, m.text)
    }
    else if (m.ruleId === 'import') {
      const spec = m.text.replace(/^import\s+(?:static\s+)?/, '').replace(/;\s*$/, '').replace(/\s+as\s+\w+$/, '').trim()
      importsOf.set(m.file, [...(importsOf.get(m.file) ?? []), spec])
    }
  }
  const testFiles = files.filter(f => layout.isTestFile(f))
  lang.importers = (c) => {
    const pkg = packageOf.get(c.file) ?? ''
    const fqn = pkg === '' ? c.name : `${pkg}.${c.name}`
    const word = new RegExp(`\\b${c.name.replace(/\$/g, '\\$')}\\b`)
    const out = new Set<string>()
    // Another module can declare the same fully qualified name; only the owning module's tests use this helper.
    const owner = unitOf(c.file, units)
    for (const file of testFiles) {
      if (unitOf(file, units) !== owner) {
        continue
      }
      const specs = importsOf.get(file) ?? []
      if (specs.some(s => s === fqn || s.startsWith(`${fqn}.`) || (pkg !== '' && s === `${pkg}.*`))) {
        out.add(file)
      }
      // Same package: Kotlin and Java use the name without an import.
      else if ((packageOf.get(file) ?? '') === pkg && word.test(readFileSync(join(rootDir, file), 'utf-8'))) {
        out.add(file)
      }
    }
    return out
  }
  return lang
}
