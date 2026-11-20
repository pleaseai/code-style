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

/**
 * The designated helper dir under the candidate's own test root; else the one
 * under the test root holding the importers; else every helper dir (the caller
 * names them all).
 */
function suggestedDirs(lang: HelperLanguage, unit: Unit, file: string, importers: Set<string>): string[] {
  const dirs = lang.layout.helperDirs(unit)
  const rootOf = (d: string): string => posix.dirname(d)
  const own = dirs.filter(d => isUnder(relativeTo(file, unit.dir), rootOf(d)))
  const used = dirs.filter(d => [...importers].some(f => unitOf(f, lang.units) === unit && isUnder(relativeTo(f, unit.dir), rootOf(d))))
  const picked = own.length > 0 ? own.slice(0, 1) : used.length > 0 ? used : dirs
  return picked.map(d => `${joinPath(unit.dir, d)}/`)
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
    const unit = unitOf(candidate.file, lang.units)
    // A unit without a designated helper location (a multiplatform module) has nowhere to move a helper to.
    if (unit != null && lang.layout.helperDirs(unit).length === 0) {
      continue
    }
    const importers = new Set([...lang.importers(candidate)].filter(f => !inFixtureProject(f, lang.units)))
    importers.delete(candidate.file)
    if (importers.size < 2) {
      continue
    }
    if (unit == null) {
      unitless.push(candidate.file)
      continue
    }
    const targets = suggestedDirs(lang, unit, candidate.file, importers)
    const target = targets.join(' or ')
    findings.push({
      slug: SLUG,
      kind: 'shared-helper-outside-location',
      severity: 'warning',
      language: lang.language,
      file: candidate.file,
      line: candidate.line,
      message: `Shared test helper \`${candidate.name}\` is imported by ${importers.size} test files (${[...importers].sort().slice(0, 3).join(', ')}) but declared outside ${target}. Move it ${targets.length > 1 ? 'to one of them' : 'there'}.`,
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

function unquote(text: string): string {
  return text.replace(/^['"`]|['"`]$/g, '')
}

const JS_TO_SOURCE = new Map([
  ['.js', ['.ts', '.tsx']],
  ['.jsx', ['.tsx']],
  ['.mjs', ['.mts']],
  ['.cjs', ['.cts']],
])

function resolveRelative(importer: string, spec: string, fileSet: Set<string>, exts: string[]): string | undefined {
  if (!spec.startsWith('.')) {
    return undefined
  }
  const base = posix.normalize(posix.join(posix.dirname(importer), spec))
  // `./helpers.js` written for ESM resolution may point at `helpers.ts`; the
  // runtime suffix maps to its own source flavor (`.mjs` → `.mts`, `.cjs` → `.cts`).
  const jsMatch = /\.(?:[cm]?js|jsx)$/.exec(base)
  const stripped = jsMatch == null ? base : base.slice(0, jsMatch.index)
  const mapped = jsMatch == null ? [] : (JS_TO_SOURCE.get(jsMatch[0]) ?? []).map(e => `${stripped}${e}`)
  const options = [base, ...mapped, ...exts.map(e => `${base}${e}`), ...exts.map(e => `${base}/index${e}`)]
  return options.find(o => fileSet.has(o))
}

const IMPORTED_NAME = new Map([['import-namespace', '*'], ['import-default', 'default']])

function tsImportsByTarget(matches: ExtractMatch[], layout: TestLayout, fileSet: Set<string>): Map<string, Map<string, Set<string>>> {
  const imports = new Map<string, Map<string, Set<string>>>()
  for (const m of matches) {
    if (!['import-name', 'import-namespace', 'import-default'].includes(m.ruleId) || !layout.isTestFile(m.file)) {
      continue
    }
    const target = resolveRelative(m.file, unquote(m.vars.SRC ?? ''), fileSet, layout.sourceExtensions)
    if (target == null) {
      continue
    }
    const name = IMPORTED_NAME.get(m.ruleId) ?? m.text
    const byName = imports.get(target) ?? new Map<string, Set<string>>()
    byName.set(name, (byName.get(name) ?? new Set<string>()).add(m.file))
    imports.set(target, byName)
  }
  return imports
}

interface TsExports {
  aliases: Map<string, Map<string, string[]>>
  exported: Map<string, Set<string>>
  defaults: Map<string, Set<string>>
}

function tsExports(matches: ExtractMatch[]): TsExports {
  const ex: TsExports = { aliases: new Map(), exported: new Map(), defaults: new Map() }
  for (const m of matches) {
    if (m.ruleId === 'export-local-alias' && m.vars.ALIAS != null) {
      const byLocal = ex.aliases.get(m.file) ?? new Map<string, string[]>()
      byLocal.set(m.text, [...(byLocal.get(m.text) ?? []), m.vars.ALIAS])
      ex.aliases.set(m.file, byLocal)
    }
    else if (m.ruleId === 'export-name') {
      ex.exported.set(m.file, (ex.exported.get(m.file) ?? new Set<string>()).add(m.text))
    }
    else if (m.ruleId === 'export-default-local') {
      ex.defaults.set(m.file, (ex.defaults.get(m.file) ?? new Set<string>()).add(m.text))
    }
  }
  return ex
}

function tsPublicNames(c: Candidate, ex: TsExports): string[] {
  const aliased = ex.aliases.get(c.file)?.get(c.name) ?? []
  const takenByAlias = [...(ex.aliases.get(c.file)?.values() ?? [])].some(names => names.includes(c.name))
  const direct = (ex.exported.get(c.file)?.has(c.name) ?? false) && !takenByAlias
  const isDefault = ex.defaults.get(c.file)?.has(c.name) === true
  return [...(direct ? [c.name] : []), ...aliased, ...(isDefault ? ['default'] : [])]
}

export function typescriptHelpers(
  layout: TestLayout,
  units: Unit[],
  matches: ExtractMatch[],
  fileSet: Set<string>,
): HelperLanguage {
  const lang: HelperLanguage = { language: 'typescript', layout, units, candidates: [], importers: () => new Set() }
  lang.candidates = matches.flatMap(m => (m.ruleId === 'helper-candidate' && isTestSide(m.file, lang, u => u.testRoots)
    ? [{ file: m.file, line: m.line, name: m.text }]
    : []))
  const imports = tsImportsByTarget(matches, layout, fileSet)
  const ex = tsExports(matches)
  lang.importers = (c) => {
    const byName = imports.get(c.file)
    const publicNames = tsPublicNames(c, ex)
    return new Set([...publicNames.flatMap(n => [...(byName?.get(n) ?? [])]), ...(publicNames.length > 0 ? [...(byName?.get('*') ?? [])] : [])])
  }
  return lang
}

interface DartCombinators {
  shown: Map<string, Set<string>>
  hidden: Map<string, Set<string>>
  showCombinators: Map<string, number>
  uriCount: Map<string, number>
}

function dartCombinators(matches: ExtractMatch[]): DartCombinators {
  const cs: DartCombinators = { shown: new Map(), hidden: new Map(), showCombinators: new Map(), uriCount: new Map() }
  for (const m of matches) {
    const key = `${m.file}\0${m.vars.SRC ?? ''}`
    if (m.ruleId === 'import-show') {
      cs.shown.set(key, (cs.shown.get(key) ?? new Set()).add(m.text))
    }
    else if (m.ruleId === 'import-hide') {
      cs.hidden.set(key, (cs.hidden.get(key) ?? new Set()).add(m.text))
    }
    else if (m.ruleId === 'import-show-combinator') {
      cs.showCombinators.set(key, (cs.showCombinators.get(key) ?? 0) + 1)
    }
    else if (m.ruleId === 'import-uri') {
      const uriKey = `${m.file}\0${m.text}`
      cs.uriCount.set(uriKey, (cs.uriCount.get(uriKey) ?? 0) + 1)
    }
  }
  return cs
}

function dartAmbiguous(cs: DartCombinators, key: string): boolean {
  return (cs.showCombinators.get(key) ?? 0) > 1 || ((cs.uriCount.get(key) ?? 0) > 1 && (cs.shown.has(key) || cs.hidden.has(key)))
}

function dartImportTarget(importer: string, uri: string, fileSet: Set<string>): string | undefined {
  if (uri.startsWith('package:') || uri.startsWith('dart:')) {
    return undefined
  }
  return resolveRelative(importer, uri.startsWith('.') ? uri : `./${uri}`, fileSet, [])
}

export function dartHelpers(
  layout: TestLayout,
  units: Unit[],
  matches: ExtractMatch[],
  fileSet: Set<string>,
): HelperLanguage {
  const lang: HelperLanguage = { language: 'dart', layout, units, candidates: [], importers: () => new Set() }
  lang.candidates = matches.flatMap(m => ((m.ruleId === 'top-level-name' || m.ruleId === 'top-level-type-alias') && HELPER_NAME.test(m.text) && isTestSide(m.file, lang, u => u.testRoots)
    ? [{ file: m.file, line: m.line, name: m.text }]
    : []))
  const cs = dartCombinators(matches)
  const withheld = new Set<string>()
  lang.withheld = { files: withheld, reason: 'repeated imports of one library with show/hide, or successive `show` clauses' }
  const imports = new Map<string, Array<{ importer: string, names: Set<string> | null, hides: Set<string> }>>()
  for (const m of matches) {
    if (m.ruleId !== 'import-uri' || !layout.isTestFile(m.file)) {
      continue
    }
    const target = dartImportTarget(m.file, unquote(m.text), fileSet)
    if (target == null) {
      continue
    }
    const key = `${m.file}\0${m.text}`
    if (dartAmbiguous(cs, key)) {
      withheld.add(m.file)
      continue
    }
    const list = imports.get(target) ?? []
    list.push({ importer: m.file, names: cs.shown.get(key) ?? null, hides: cs.hidden.get(key) ?? new Set() })
    imports.set(target, list)
  }
  lang.importers = c => new Set(
    (imports.get(c.file) ?? []).filter(i => (i.names == null || i.names.has(c.name)) && !i.hides.has(c.name)).map(i => i.importer),
  )
  return lang
}

/** The other JVM language of a mixed Kotlin/Java module: its tests may import this language's helpers. */
export interface JvmSibling {
  layout: TestLayout
  units: Unit[]
  matches: ExtractMatch[]
}

/** A file's text, or `null` when it cannot be read (deleted or unreadable since listing). */
function readSource(rootDir: string, file: string): string | null {
  try {
    return readFileSync(join(rootDir, file), 'utf-8')
  }
  catch {
    return null
  }
}

/** Java-visible file facade of a Kotlin file's top-level members: `@file:JvmName("X")`, else `<File>Kt`. */
function kotlinFacade(file: string, pkg: string, rootDir: string): string | undefined {
  if (!file.endsWith('.kt')) {
    return undefined
  }
  const named = /@file:\s*JvmName\(\s*"([^"]+)"\s*\)/.exec(readSource(rootDir, file) ?? '')?.[1]
  const stem = posix.basename(file, '.kt').replace(/\W/g, '_')
  const facade = named ?? `${stem.charAt(0).toUpperCase()}${stem.slice(1)}Kt`
  return pkg === '' ? facade : `${pkg}.${facade}`
}

/** Whether `text` declares its own `name` (field, local, parameter, function or type), which shadows any helper of that name. */
function declaresName(text: string, name: string, file: string): boolean {
  const id = name.replace(/\$/g, '\\$')
  if (/\.kts?$/.test(file)) {
    return new RegExp(`\\b(?:val|var|fun|class|object|interface|typealias)\\s+(?:<[^>]*>\\s*)?(?:[\\w.]+\\.)?${id}\\b|(?<![\\w.])${id}\\s*:\\s*[\\w(]`).test(text)
  }
  // Java: a type declaration (`class name`), or `Type name` followed by an initializer, terminator, parameter delimiter or `(`; statements such as `return name;` are references.
  return new RegExp(`\\b(?:class|interface|enum|record)\\s+${id}\\b|(?<![\\w.])(?!(?:return|new|throw|throws|else|case|yield|assert|extends|implements|instanceof)\\b)[A-Za-z_][\\w.]*(?:<[^;(){}]*>)?(?:\\[\\])*\\s+${id}\\s*(?:=|;|\\(|,|\\)|:)`).test(text)
}

const NON_CODE = /"""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g

/** Drops comments and string literals so a name inside them is not read as a use; Kotlin string templates keep their embedded expressions. */
function stripNonCode(text: string, file: string): string {
  const kotlin = /\.kts?$/.test(file)
  return text.replace(NON_CODE, (m) => {
    if (kotlin && m.startsWith('"')) {
      return ` ${[...m.matchAll(/\$\{([^}]*)\}|\$(\w+)/g)].map(t => t[1] ?? t[2]).join(' ')} `
    }
    return ' '
  })
}

/** Whether `text` uses `name` unqualified, or qualified only by one of `qualifiers` (a member of another type is a different symbol). */
function usesName(text: string, name: string, qualifiers: string[]): boolean {
  const word = new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}\\b`, 'g')
  for (const m of text.matchAll(word)) {
    const before = text.slice(0, m.index)
    if (!before.endsWith('.') && !/\w::$/.test(before)) {
      return true
    }
    if (qualifiers.some(q => before.endsWith(`${q}.`) && !/[\w$.]$/.test(before.slice(0, -q.length - 1)))) {
      return true
    }
  }
  return false
}

interface JvmTarget {
  name: string
  pkg: string
  fqn: string
  facadeFqn: string | undefined
  qualifiers: string[]
}

interface JvmIndex {
  packageOf: Map<string, string>
  importsOf: Map<string, string[]>
  aliasOf: Map<string, string>
  bindingsOf: Map<string, Map<string, string>>
  codeOf: (file: string) => string | null
}

function jvmFileUsesHelper(file: string, t: JvmTarget, ix: JvmIndex): boolean {
  const specs = ix.importsOf.get(file) ?? []
  const explicit = specs.find(s => s === t.fqn || s.startsWith(`${t.fqn}.`) || (t.facadeFqn != null && s === `${t.facadeFqn}.${t.name}`))
  if (explicit != null) {
    const local = ix.aliasOf.get(`${file}\0${explicit}`) ?? explicit.slice(explicit.lastIndexOf('.') + 1)
    const text = ix.codeOf(file)
    return text != null && !declaresName(text, local, file)
  }
  const wildcard = specs.some(s => (t.pkg !== '' && s === `${t.pkg}.*`) || (t.facadeFqn != null && s === `${t.facadeFqn}.*`))
  const samePackage = (ix.packageOf.get(file) ?? '') === t.pkg
  return (wildcard || samePackage) && jvmMentions(file, t, ix)
}

function jvmMentions(file: string, t: JvmTarget, ix: JvmIndex): boolean {
  const bound = ix.bindingsOf.get(file)?.get(t.name)
  // An explicit import binding the name to another FQN shadows wildcard and same-package candidates.
  if (bound != null && bound !== t.fqn && !(t.facadeFqn != null && bound === `${t.facadeFqn}.${t.name}`)) {
    return false
  }
  const text = ix.codeOf(file)
  return text != null && usesName(text, t.name, t.qualifiers) && !declaresName(text, t.name, file)
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
  lang.candidates = matches.flatMap(m => (m.ruleId === 'helper-candidate' && isTestSide(m.file, lang, sourceSets)
    ? [{ file: m.file, line: m.line, name: m.text }]
    : []))
  const packageOf = new Map<string, string>()
  const importsOf = new Map<string, string[]>()
  // `file\0spec` → the local name of an `import spec as alias`.
  const aliasOf = new Map<string, string>()
  // An importer whose source cannot be read is never credited; it is withheld with a notice.
  const unreadable = new Set<string>()
  lang.withheld = { files: unreadable, reason: 'source that could not be read (deleted or unreadable since listing)' }
  const textCache = new Map<string, string | null>()
  const codeOf = (file: string): string | null => {
    if (!textCache.has(file)) {
      const source = readSource(rootDir, file)
      textCache.set(file, source == null ? null : stripNonCode(source, file).replace(/^\s*(?:import|package)\b.*$/gm, ''))
    }
    const text = textCache.get(file) ?? null
    if (text == null) {
      unreadable.add(file)
    }
    return text
  }
  for (const m of [...matches, ...(sibling?.matches ?? [])]) {
    if (m.ruleId === 'package') {
      packageOf.set(m.file, m.text)
    }
    else if (m.ruleId === 'import') {
      const bare = m.text.replace(/^import\s+(?:static\s+)?/, '').replace(/;\s*$/, '').trim()
      const spec = bare.replace(/\s+as\s+\w+$/, '')
      importsOf.set(m.file, [...(importsOf.get(m.file) ?? []), spec])
      const alias = /\s+as\s+(\w+)$/.exec(bare)?.[1]
      if (alias != null) {
        aliasOf.set(`${m.file}\0${spec}`, alias)
      }
    }
  }
  // file → simple name → FQN of its explicit (non-wildcard) imports; an explicit import shadows same-package and wildcard names.
  const bindingsOf = new Map<string, Map<string, string>>()
  for (const [file, specs] of importsOf) {
    const bound = new Map<string, string>()
    for (const spec of specs) {
      if (!spec.endsWith('.*')) {
        bound.set(aliasOf.get(`${file}\0${spec}`) ?? spec.slice(spec.lastIndexOf('.') + 1), spec)
      }
    }
    bindingsOf.set(file, bound)
  }
  const testFiles = files.filter(f => layout.isTestFile(f) || sibling?.layout.isTestFile(f) === true)
  const allUnits = [...units, ...(sibling?.units ?? [])]
  const index: JvmIndex = { packageOf, importsOf, aliasOf, bindingsOf, codeOf }
  lang.importers = (c) => {
    const pkg = packageOf.get(c.file) ?? ''
    const facadeFqn = kotlinFacade(c.file, pkg, rootDir)
    const qualifiers = [pkg, facadeFqn].filter((q): q is string => q != null && q !== '')
    const target: JvmTarget = { name: c.name, pkg, fqn: pkg === '' ? c.name : `${pkg}.${c.name}`, facadeFqn, qualifiers }
    const owner = unitOf(c.file, units)?.dir
    return new Set(testFiles.filter(file => unitOf(file, allUnits)?.dir === owner && jvmFileUsesHelper(file, target, index)))
  }
  return lang
}
