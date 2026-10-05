import type { ExtractMatch } from './ast-grep.js'
import type { TestLayout, Unit } from './layouts.js'
import type { Finding, Language } from './types.js'
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { exampleList, LANGUAGE_LABEL, UNIT_MARKER } from './check-test-paths.js'
import { inFixtureProject, isUnder, joinPath, relativeTo, unitOf } from './layouts.js'

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
  /** Test files with an import form the language's resolution cannot decide (withheld, with a notice). */
  withheld?: { files: Set<string>, reason: string }
}

export interface HelperResult {
  findings: Finding[]
  notices: string[]
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
  return inspectHelpers(lang).findings
}

/**
 * Like `checkHelpers`, plus aggregated notices for what was withheld: shared
 * helpers that belong to no package or module (no unit to suggest a location
 * in) and test files whose imports of a library cannot be evaluated.
 */
export function inspectHelpers(lang: HelperLanguage): HelperResult {
  const findings: Finding[] = []
  const notices: string[] = []
  const unitless: string[] = []
  for (const candidate of lang.candidates) {
    // A fixture project's files are test data: neither helpers nor importers.
    if (inDesignatedLocation(candidate.file, lang) || inFixtureProject(candidate.file, lang.units)) {
      continue
    }
    const importers = new Set([...lang.importers(candidate)].filter(f => !inFixtureProject(f, lang.units)))
    importers.delete(candidate.file)
    if (importers.size < 2) {
      continue
    }
    const unit = unitOf(candidate.file, lang.units)
    if (unit == null) {
      unitless.push(candidate.file)
      continue
    }
    const target = suggestedDir(lang, unit, candidate.file)
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
  const label = LANGUAGE_LABEL[lang.language]
  if (unitless.length > 0) {
    const files = [...new Set(unitless)]
    notices.push(`${label}: helper check skipped ${files.length} shared helper file(s) outside any package (${UNIT_MARKER[lang.language]}): ${exampleList(files)}`)
  }
  if (lang.withheld != null && lang.withheld.files.size > 0) {
    notices.push(`${label}: helper check withheld judgement for ${lang.withheld.files.size} test file(s) with ${lang.withheld.reason}: ${exampleList(lang.withheld.files)}`)
  }
  return { findings, notices }
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
  // `./helpers.js` written for ESM resolution may point at `helpers.ts`; the
  // runtime suffix maps to its own source flavor (`.mjs` → `.mts`, `.cjs` → `.cts`).
  const jsMatch = /\.(?:[cm]?js|jsx)$/.exec(base)
  const stripped = jsMatch == null ? base : base.slice(0, jsMatch.index)
  const jsToSource: Record<string, string[]> = {
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
    '.cjs': ['.cts'],
  }
  const mapped = jsMatch == null ? [] : (jsToSource[jsMatch[0]] ?? []).map(e => `${stripped}${e}`)
  const options = [base, ...mapped, ...exts.map(e => `${base}${e}`), ...exts.map(e => `${base}/index${e}`)]
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
  // file → local name → names it is exported under (`export { local as exported }`)
  const aliases = new Map<string, Map<string, string[]>>()
  for (const m of matches) {
    if (m.ruleId === 'export-local-alias' && m.vars.ALIAS != null) {
      const byLocal = aliases.get(m.file) ?? new Map<string, string[]>()
      byLocal.set(m.text, [...(byLocal.get(m.text) ?? []), m.vars.ALIAS])
      aliases.set(m.file, byLocal)
    }
  }
  // file → names it exports under (`export-name` also covers `export { local }` and aliases)
  const exported = new Map<string, Set<string>>()
  for (const m of matches) {
    if (m.ruleId === 'export-name') {
      exported.set(m.file, (exported.get(m.file) ?? new Set<string>()).add(m.text))
    }
  }
  lang.importers = (c) => {
    const byName = imports.get(c.file)
    // Names the declaration is public under: its own (when exported directly, not just as another's alias) plus `export { local as alias }`.
    const aliased = aliases.get(c.file)?.get(c.name) ?? []
    const takenByAlias = [...(aliases.get(c.file)?.values() ?? [])].some(names => names.includes(c.name))
    const direct = (exported.get(c.file)?.has(c.name) ?? false) && !takenByAlias
    const publicNames = [...(direct ? [c.name] : []), ...aliased]
    // A namespace import only sees exports; the candidate extraction also lists private declarations.
    return new Set([...publicNames.flatMap(n => [...(byName?.get(n) ?? [])]), ...(publicNames.length > 0 ? [...(byName?.get('*') ?? [])] : [])])
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
    .filter(m => (m.ruleId === 'top-level-name' || m.ruleId === 'top-level-type-alias') && HELPER_NAME.test(m.text) && isTestSide(m.file, lang, u => u.testRoots))
    .map(m => ({ file: m.file, line: m.line, name: m.text }))
  // `show`/`hide` lists per (importer, uri text); an import without `show` imports everything.
  const shown = new Map<string, Set<string>>()
  const hidden = new Map<string, Set<string>>()
  const showCombinators = new Map<string, number>()
  const uriCount = new Map<string, number>()
  const keyOf = (m: ExtractMatch): string => `${m.file}\0${m.vars.SRC ?? ''}`
  for (const m of matches) {
    if (m.ruleId === 'import-show') {
      shown.set(keyOf(m), (shown.get(keyOf(m)) ?? new Set()).add(m.text))
    }
    else if (m.ruleId === 'import-hide') {
      hidden.set(keyOf(m), (hidden.get(keyOf(m)) ?? new Set()).add(m.text))
    }
    else if (m.ruleId === 'import-show-combinator') {
      showCombinators.set(keyOf(m), (showCombinators.get(keyOf(m)) ?? 0) + 1)
    }
    else if (m.ruleId === 'import-uri') {
      const key = `${m.file}\0${m.text}`
      uriCount.set(key, (uriCount.get(key) ?? 0) + 1)
    }
  }
  // Extraction keeps no per-import identity, so a library imported more than once with combinators,
  // or an import with successive `show` clauses (which intersect), cannot be evaluated: withhold it.
  const withheld = new Set<string>()
  const ambiguous = (key: string): boolean =>
    (showCombinators.get(key) ?? 0) > 1 || ((uriCount.get(key) ?? 0) > 1 && (shown.has(key) || hidden.has(key)))
  lang.withheld = { files: withheld, reason: 'repeated imports of one library with show/hide, or successive `show` clauses' }
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
    const key = `${m.file}\0${m.text}`
    if (ambiguous(key)) {
      withheld.add(m.file)
      continue
    }
    const list = imports.get(target) ?? []
    list.push({ importer: m.file, names: shown.get(key) ?? null, hides: hidden.get(key) ?? new Set() })
    imports.set(target, list)
  }
  lang.importers = c => new Set(
    (imports.get(c.file) ?? []).filter(i => (i.names == null || i.names.has(c.name)) && !i.hides.has(c.name)).map(i => i.importer),
  )
  return lang
}

// --- Kotlin / Java ----------------------------------------------------------

/** The other JVM language of a mixed Kotlin/Java module: its tests may import this language's helpers. */
export interface JvmSibling {
  layout: TestLayout
  units: Unit[]
  matches: ExtractMatch[]
}

export function jvmHelpers(
  layout: TestLayout,
  units: Unit[],
  matches: ExtractMatch[],
  files: string[],
  rootDir: string,
  sibling?: JvmSibling,
): HelperLanguage {
  const language = layout.language as 'kotlin' | 'java'
  const lang: HelperLanguage = { language, layout, units, candidates: [], importers: () => new Set() }
  const sourceSets = (u: Unit): string[] => [`src/test/${language}`, `src/testFixtures/${language}`].filter(s => s !== u.sourceRoots[0])
  lang.candidates = matches
    .filter(m => m.ruleId === 'helper-candidate' && isTestSide(m.file, lang, sourceSets))
    .map(m => ({ file: m.file, line: m.line, name: m.text }))
  const packageOf = new Map<string, string>()
  const importsOf = new Map<string, string[]>()
  for (const m of [...matches, ...(sibling?.matches ?? [])]) {
    if (m.ruleId === 'package') {
      packageOf.set(m.file, m.text)
    }
    else if (m.ruleId === 'import') {
      const spec = m.text.replace(/^import\s+(?:static\s+)?/, '').replace(/;\s*$/, '').replace(/\s+as\s+\w+$/, '').trim()
      importsOf.set(m.file, [...(importsOf.get(m.file) ?? []), spec])
    }
  }
  const testFiles = files.filter(f => layout.isTestFile(f) || sibling?.layout.isTestFile(f) === true)
  const allUnits = [...units, ...(sibling?.units ?? [])]
  lang.importers = (c) => {
    const pkg = packageOf.get(c.file) ?? ''
    const fqn = pkg === '' ? c.name : `${pkg}.${c.name}`
    const word = new RegExp(`\\b${c.name.replace(/\$/g, '\\$')}\\b`)
    const out = new Set<string>()
    // Another module can declare the same fully qualified name; only the owning module's tests use this helper.
    const owner = unitOf(c.file, units)?.dir
    for (const file of testFiles) {
      if (unitOf(file, allUnits)?.dir !== owner) {
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
