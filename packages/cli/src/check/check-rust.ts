import type { ExtractMatch } from './ast-grep.js'
import type { CargoMetadata, CargoMetadataProvider, Finding } from './types.js'
import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { join, posix, relative } from 'node:path'
import process from 'node:process'
import { exampleList } from './check-test-paths.js'
import { CargoUnavailableError } from './errors.js'
import { isUnder, joinPath, relativeTo } from './layouts.js'

/** Subdirectories of `tests/` conventionally holding inputs a test target loads at runtime (trybuild, compiletest, fixtures). */
const RUNTIME_FIXTURE_DIRS = new Set(['ui', 'compile-fail', 'compile-pass', 'fixtures', 'testdata', 'test-data', 'test_data'])

interface ModDecl {
  name: string
  /** `#[path = "…"]` value, when present. */
  path?: string
}

interface RustPackage {
  /** Package directory relative to the checked root. */
  dir: string
  /** Every target's entry file, relative to the checked root. */
  roots: string[]
  /** Entry files of `kind: test` targets. */
  testRoots: string[]
}

export interface RustCheckResult {
  findings: Finding[]
  notices: string[]
}

/** Runs `cargo metadata --no-deps --format-version 1` in `dir`. */
export function cargoMetadataFromCli(dir: string): CargoMetadata {
  const cargo = process.env.CARGO ?? 'cargo'
  const probe = spawnSync(cargo, ['--version'], { encoding: 'utf-8' })
  if (probe.error != null || probe.status !== 0) {
    throw new CargoUnavailableError(`\`${cargo} --version\` failed${probe.error != null ? `: ${probe.error.message}` : ''}`)
  }
  const res = spawnSync(cargo, ['metadata', '--no-deps', '--format-version', '1'], {
    cwd: dir,
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024,
  })
  if (res.error != null) {
    throw new Error(res.error.message)
  }
  if (res.status !== 0) {
    throw new Error((res.stderr ?? '').trim().split('\n').at(-1) || `exit ${res.status ?? res.signal}`)
  }
  return JSON.parse(res.stdout) as CargoMetadata
}

function toRootRelative(rootDir: string, absolute: string): string | null {
  let real = absolute
  try {
    real = realpathSync(absolute)
  }
  catch {
    // Keep the path as cargo reported it.
  }
  const rel = relative(rootDir, real).split('\\').join('/')
  return rel.startsWith('..') || rel.startsWith('/') ? null : rel
}

function loadPackages(
  rootDir: string,
  files: string[],
  provider: CargoMetadataProvider,
): { packages: RustPackage[], notices: string[] } {
  const manifests = files.filter(f => posix.basename(f) === 'Cargo.toml').sort((a, b) => a.split('/').length - b.split('/').length)
  const seen = new Map<string, RustPackage>()
  const notices: string[] = []
  for (const manifest of manifests) {
    if (seen.has(manifest)) {
      continue
    }
    const dir = posix.dirname(manifest)
    let metadata: CargoMetadata | null
    try {
      metadata = provider(join(rootDir, dir))
    }
    catch (err) {
      if (err instanceof CargoUnavailableError) {
        throw err
      }
      notices.push(`Rust: test-path and helper checks skipped that crate (\`cargo metadata\` failed in ${dir}: ${err instanceof Error ? err.message : String(err)}).`)
      continue
    }
    for (const pkg of metadata?.packages ?? []) {
      const manifestRel = toRootRelative(rootDir, pkg.manifest_path)
      if (manifestRel == null || seen.has(manifestRel)) {
        continue
      }
      const roots: string[] = []
      const testRoots: string[] = []
      for (const target of pkg.targets) {
        const src = toRootRelative(rootDir, target.src_path)
        if (src == null) {
          continue
        }
        roots.push(src)
        if (target.kind.includes('test')) {
          testRoots.push(src)
        }
      }
      const pkgDir = posix.dirname(manifestRel)
      seen.set(manifestRel, { dir: pkgDir === '.' ? '' : pkgDir, roots, testRoots })
    }
  }
  return { packages: [...seen.values()], notices }
}

/** Files `mod name;` in `file` may load (Rust 2018 module resolution). */
function modCandidates(file: string, decl: ModDecl, modRs: boolean): string[] {
  const dir = posix.dirname(file) === '.' ? '' : posix.dirname(file)
  if (decl.path != null) {
    // Outside inline blocks, `#[path]` is relative to the declaring file's directory.
    return [posix.normalize(joinPath(dir, decl.path))]
  }
  const base = modRs ? dir : joinPath(dir, posix.basename(file, '.rs'))
  return [joinPath(base, `${decl.name}.rs`), joinPath(base, decl.name, 'mod.rs')]
}

/** Module files reachable from `entry` through `mod` declarations (entry excluded). */
function reachable(entry: string, decls: Map<string, ModDecl[]>, fileSet: Set<string>): Set<string> {
  const out = new Set<string>()
  const queue: Array<{ file: string, modRs: boolean }> = [{ file: entry, modRs: true }]
  while (queue.length > 0) {
    const { file, modRs } = queue.pop()!
    for (const decl of decls.get(file) ?? []) {
      const target = modCandidates(file, decl, modRs).find(c => fileSet.has(c))
      if (target != null && target !== entry && !out.has(target)) {
        out.add(target)
        queue.push({ file: target, modRs: decl.path != null || posix.basename(target) === 'mod.rs' })
      }
    }
  }
  return out
}

/**
 * Directory whose files a `mod x;` nested in an inline module or fn body of
 * `file` could load: the file's own directory for a crate root, `mod.rs` or
 * `#[path]`-loaded file, `<stem>/` for a plain `foo.rs`.
 */
function nestedModDir(file: string, isRoot: boolean, pathLoaded: Set<string>): string {
  const dir = posix.dirname(file) === '.' ? '' : posix.dirname(file)
  return isRoot || pathLoaded.has(file) || posix.basename(file) === 'mod.rs'
    ? dir
    : joinPath(dir, posix.basename(file, '.rs'))
}

/** Path segments of every string literal in the package's `tests/*.rs` test targets. */
function literalSegments(rootDir: string, pkg: RustPackage): Set<string> {
  const out = new Set<string>()
  for (const root of pkg.testRoots) {
    let text: string
    try {
      text = readFileSync(join(rootDir, root), 'utf-8')
    }
    catch {
      continue
    }
    for (const lit of text.matchAll(/"([^"\n]*)"/g)) {
      for (const seg of (lit[1] ?? '').split('/')) {
        out.add(seg)
      }
    }
  }
  return out
}

/** Declarations and flags collected from the ast-grep extraction matches. */
interface RustMatchIndex {
  decls: Map<string, ModDecl[]>
  unitTestFiles: Set<string>
  nestedDeclFiles: Set<string>
  pathLoaded: Set<string>
  nestedPathFiles: Set<string>
  macroModFiles: Set<string>
  includeFiles: Set<string>
}

/** Per-package state shared by the per-file classification. */
interface PackageContext {
  pkg: RustPackage
  testsDir: string
  commonDir: string
  roots: Set<string>
  owned: (f: string) => boolean
  reachabilityUnknown: (f: string) => boolean
  fromTarget: Map<string, Set<string>>
  reachedByAny: Set<string>
  /** Computed at most once per package, and only when a file needs it. */
  literals: () => Set<string>
}

/** Findings and skipped-file sets accumulated across packages. */
interface ScanState {
  findings: Finding[]
  runtimeLoadable: Set<string>
  fixtureUnitTests: Set<string>
}

function recordModDecl(index: RustMatchIndex, m: ExtractMatch): void {
  // `mod r#async;` loads `async.rs`. `mod-decl-cfg-path` matches the attribute (one per conditional `path`), so the module name is `$NAME`.
  const name = m.ruleId === 'mod-decl-cfg-path' ? (m.vars.NAME ?? '') : m.text
  index.decls.set(m.file, [...(index.decls.get(m.file) ?? []), { name: name.replace(/^r#/, ''), path: m.vars.PATH }])
  if (m.vars.PATH != null) {
    const dir = posix.dirname(m.file) === '.' ? '' : posix.dirname(m.file)
    index.pathLoaded.add(posix.normalize(joinPath(dir, m.vars.PATH)))
  }
}

function indexMatches(matches: ExtractMatch[]): RustMatchIndex {
  const index: RustMatchIndex = {
    decls: new Map(),
    unitTestFiles: new Set(),
    nestedDeclFiles: new Set(),
    pathLoaded: new Set(),
    nestedPathFiles: new Set(),
    macroModFiles: new Set(),
    includeFiles: new Set(),
  }
  for (const m of matches) {
    if (m.ruleId === 'mod-decl' || m.ruleId === 'mod-decl-cfg-path') {
      recordModDecl(index, m)
    }
    else if (m.ruleId === 'mod-decl-nested') {
      index.nestedDeclFiles.add(m.file)
    }
    else if (m.ruleId === 'mod-decl-nested-path') {
      index.nestedPathFiles.add(m.file)
    }
    else if (m.ruleId === 'macro-mod-decl') {
      index.macroModFiles.add(m.file)
    }
    else if (m.ruleId === 'include-macro' || m.ruleId === 'macro-include') {
      // An included file can declare modules anywhere in the crate (`#[path = "../x.rs"]`), so any `include!` withholds the whole package.
      index.includeFiles.add(m.file)
    }
    else if (m.ruleId === 'test-attr') {
      index.unitTestFiles.add(m.file)
    }
  }
  return index
}

type WithheldDirs = Array<{ file: string, dir: string }>

/** Subtrees whose reachability is unknown: `mod x;` in nested modules (`unknownDirs`) and `include!`/macro-body `mod x;` (`loadDirs`). */
function withheldDirs(
  pkg: RustPackage,
  roots: Set<string>,
  owned: (f: string) => boolean,
  index: RustMatchIndex,
): { unknownDirs: WithheldDirs, loadDirs: WithheldDirs } {
  // `mod x;` inside an inline module or fn body is not followed: withhold judgement only for the subtree it could load from.
  // A nested `#[path]` can load a file anywhere in the crate, so it withholds the whole package.
  const unknownDirs = [...index.nestedDeclFiles]
    .filter(owned)
    .map(f => ({ file: f, dir: index.nestedPathFiles.has(f) ? pkg.dir : nestedModDir(f, roots.has(f), index.pathLoaded) }))
  // `include!` and `mod x;` in macro bodies load files without a `mod` item: withhold the subtree (or the crate) they can reach.
  const loadDirs = [
    ...[...index.macroModFiles].filter(owned).map(f => ({ file: f, dir: pkg.dir })),
    ...[...index.includeFiles].filter(owned).map(f => ({ file: f, dir: pkg.dir })),
  ]
  return { unknownDirs, loadDirs }
}

function pushWithheldNotices(notices: string[], pkg: RustPackage, unknownDirs: WithheldDirs, loadDirs: WithheldDirs): void {
  if (loadDirs.length > 0) {
    const where = [...new Set(loadDirs.map(u => `${u.dir === '' ? '.' : u.dir}/ (from ${u.file})`))].sort().join(', ')
    notices.push(`Rust: test-reachability check skipped for ${where} (crate ${pkg.dir === '' ? '.' : pkg.dir} uses \`include!\` or a macro body containing \`mod x;\`, which loads files without a followed \`mod\` item).`)
  }
  if (unknownDirs.length > 0) {
    const where = unknownDirs.map(u => `${u.dir === '' ? '.' : u.dir}/ (from ${u.file})`).sort().join(', ')
    notices.push(`Rust: test-reachability check skipped for ${where} (crate ${pkg.dir === '' ? '.' : pkg.dir} declares \`mod x;\` inside an inline module or fn body, which is not followed).`)
  }
}

/** Which files each target reaches through `mod` declarations: per test target, and across all targets. */
function reachMaps(
  pkg: RustPackage,
  decls: Map<string, ModDecl[]>,
  fileSet: Set<string>,
): { fromTarget: Map<string, Set<string>>, reachedByAny: Set<string> } {
  const fromTarget = new Map<string, Set<string>>()
  const reachedByAny = new Set<string>()
  for (const root of pkg.roots) {
    for (const f of reachable(root, decls, fileSet)) {
      reachedByAny.add(f)
      if (pkg.testRoots.includes(root)) {
        fromTarget.set(f, (fromTarget.get(f) ?? new Set()).add(root))
      }
    }
  }
  return { fromTarget, reachedByAny }
}

function buildPackageContext(
  rootDir: string,
  pkg: RustPackage,
  manifestDirs: string[],
  fileSet: Set<string>,
  index: RustMatchIndex,
  notices: string[],
): PackageContext {
  const testsDir = joinPath(pkg.dir, 'tests')
  // Every listed Cargo.toml deeper than this package is a boundary, even when its metadata failed to load.
  const nestedDirs = manifestDirs.filter(d => d !== pkg.dir && isUnder(d, pkg.dir))
  const owned = (f: string): boolean => isUnder(f, pkg.dir) && !nestedDirs.some(d => isUnder(f, d))
  const roots = new Set(pkg.roots)
  const { unknownDirs, loadDirs } = withheldDirs(pkg, roots, owned, index)
  const reachabilityUnknown = (f: string): boolean => unknownDirs.some(u => isUnder(f, u.dir)) || loadDirs.some(u => isUnder(f, u.dir))
  pushWithheldNotices(notices, pkg, unknownDirs, loadDirs)
  let literals: Set<string> | undefined
  return {
    pkg,
    testsDir,
    commonDir: joinPath(testsDir, 'common'),
    roots,
    owned,
    reachabilityUnknown,
    ...reachMaps(pkg, index.decls, fileSet),
    literals: () => (literals ??= literalSegments(rootDir, pkg)),
  }
}

function sharedHelperFinding(file: string, ctx: PackageContext): Finding | null {
  const users = ctx.fromTarget.get(file)
  if (users == null || users.size < 2 || isUnder(file, ctx.commonDir)) {
    return null
  }
  return {
    slug: 'test-helpers-in-dedicated-location',
    kind: 'shared-helper-outside-location',
    severity: 'warning',
    language: 'rust',
    file,
    message: `Helper module is shared by ${users.size} test targets (${[...users].sort().slice(0, 3).join(', ')}) but lives outside ${ctx.commonDir}/. Move it to ${ctx.commonDir}/mod.rs (or a submodule) and load it with \`mod common;\`.`,
  }
}

function undiscoveredIntegrationTest(file: string, ctx: PackageContext, state: ScanState): Finding | null {
  const inner = relativeTo(file, ctx.testsDir).split('/')
  const inTargetDir = inner.length > 1 && ctx.pkg.testRoots.includes(joinPath(ctx.testsDir, inner[0] ?? '', 'main.rs'))
  if (ctx.reachabilityUnknown(file) || ctx.roots.has(file) || ctx.reachedByAny.has(file) || isUnder(file, ctx.commonDir) || inTargetDir) {
    return null
  }
  const sub = inner.length > 1 ? inner[0] ?? '' : ''
  if (sub !== '' && (RUNTIME_FIXTURE_DIRS.has(sub) || ctx.literals().has(sub))) {
    state.runtimeLoadable.add(file)
    return null
  }
  return {
    slug: 'test-path-derivable-from-source',
    kind: 'undiscovered-integration-test',
    severity: 'warning',
    language: 'rust',
    file,
    message: 'Cargo does not compile this file: it is not a test target and no test target loads it with `mod`. Move it to tests/<name>.rs (or tests/<name>/main.rs), or register it with a [[test]] entry in Cargo.toml.',
  }
}

function unreachableUnitTest(file: string, ctx: PackageContext, index: RustMatchIndex, state: ScanState): Finding | null {
  if (ctx.reachabilityUnknown(file) || !index.unitTestFiles.has(file) || ctx.roots.has(file) || ctx.reachedByAny.has(file)) {
    return null
  }
  const literals = ctx.literals()
  const dirSegments = relativeTo(file, ctx.pkg.dir).split('/').slice(0, -1)
  if (dirSegments.some(seg => RUNTIME_FIXTURE_DIRS.has(seg) || literals.has(seg))) {
    state.fixtureUnitTests.add(file)
    return null
  }
  return {
    slug: 'test-path-derivable-from-source',
    kind: 'unreachable-unit-test',
    severity: 'warning',
    language: 'rust',
    file,
    message: 'File has #[test] functions but no target reaches it through `mod` declarations, so they never run. Declare it from its source module (`#[cfg(test)] mod tests;` or `#[cfg(test)] #[path = "…"] mod tests;`).',
  }
}

function classifyRustFile(file: string, ctx: PackageContext, index: RustMatchIndex, state: ScanState): void {
  const shared = sharedHelperFinding(file, ctx)
  if (shared != null) {
    state.findings.push(shared)
  }
  const finding = isUnder(file, ctx.testsDir)
    ? undiscoveredIntegrationTest(file, ctx, state)
    : unreachableUnitTest(file, ctx, index, state)
  if (finding != null) {
    state.findings.push(finding)
  }
}

function pushSkippedNotices(notices: string[], state: ScanState): void {
  const { runtimeLoadable, fixtureUnitTests } = state
  if (runtimeLoadable.size > 0) {
    notices.push(`Rust: undiscovered-integration-test check skipped ${runtimeLoadable.size} file(s) in tests/ subdirectories a test target may load at runtime (trybuild/compiletest fixtures, or a directory named in a string literal of a tests/*.rs target): ${exampleList(runtimeLoadable)}`)
  }
  if (fixtureUnitTests.size > 0) {
    notices.push(`Rust: unreachable-unit-test check skipped ${fixtureUnitTests.size} file(s) under fixture directories (a fixtures/ui/testdata-style directory, or one named in a string literal of a tests/*.rs target) that a test may load at runtime: ${exampleList(fixtureUnitTests)}`)
  }
}

/**
 * Rust layer-3 checks (ADR-0022 §3):
 * - `tests/**.rs` files Cargo never compiles (not a test target, not reached
 *   by `mod` from one), excluding `tests/common/` and submodules of a
 *   `tests/<name>/main.rs` target directory;
 * - a helper module outside `tests/common/` pulled in by two or more test
 *   targets;
 * - unit-test files (`#[test]`) that no target reaches through `mod`
 *   declarations (split `#[cfg(test)] mod tests;` files are found by
 *   following declarations, never by file name).
 */
export function checkRust(
  rootDir: string,
  files: string[],
  matches: ExtractMatch[],
  provider: CargoMetadataProvider = cargoMetadataFromCli,
): RustCheckResult {
  const rustFiles = files.filter(f => f.endsWith('.rs'))
  if (!files.some(f => posix.basename(f) === 'Cargo.toml') || rustFiles.length === 0) {
    return { findings: [], notices: [] }
  }
  let loaded: ReturnType<typeof loadPackages>
  try {
    loaded = loadPackages(rootDir, files, provider)
  }
  catch (err) {
    if (err instanceof CargoUnavailableError) {
      return {
        findings: [],
        notices: [`Rust: test-path and helper checks skipped: cargo is not available (${err.message}). Install Rust or run the check where cargo is on PATH.`],
      }
    }
    throw err
  }
  const fileSet = new Set(files)
  const index = indexMatches(matches)
  const manifestDirs = files
    .filter(f => posix.basename(f) === 'Cargo.toml')
    .map(f => posix.dirname(f))
    .map(d => (d === '.' ? '' : d))
  const state: ScanState = { findings: [], runtimeLoadable: new Set(), fixtureUnitTests: new Set() }
  for (const pkg of loaded.packages) {
    const ctx = buildPackageContext(rootDir, pkg, manifestDirs, fileSet, index, loaded.notices)
    for (const file of rustFiles.filter(ctx.owned)) {
      classifyRustFile(file, ctx, index, state)
    }
  }
  pushSkippedNotices(loaded.notices, state)
  return { findings: state.findings, notices: loaded.notices }
}
