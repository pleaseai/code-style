import type { ExtractMatch } from './ast-grep.js'
import type { CargoMetadata, CargoMetadataProvider, Finding } from './types.js'
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { join, posix, relative } from 'node:path'
import process from 'node:process'
import { CargoUnavailableError } from './errors.js'
import { isUnder, joinPath, relativeTo } from './layouts.js'

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
  if (res.status !== 0) {
    throw new Error(res.stderr.trim().split('\n').at(-1) ?? `exit ${res.status}`)
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
      notices.push(`Rust: \`cargo metadata\` failed in ${dir === '.' ? '.' : dir} (${err instanceof Error ? err.message : String(err)}); skipped that crate.`)
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
        notices: [`Rust: cargo is not available (${err.message}); skipped Rust test-path and helper checks. Install Rust or run the check where cargo is on PATH.`],
      }
    }
    throw err
  }
  const fileSet = new Set(files)
  const decls = new Map<string, ModDecl[]>()
  const unitTestFiles = new Set<string>()
  for (const m of matches) {
    if (m.ruleId === 'mod-decl') {
      decls.set(m.file, [...(decls.get(m.file) ?? []), { name: m.text, path: m.vars.PATH }])
    }
    else if (m.ruleId === 'test-attr') {
      unitTestFiles.add(m.file)
    }
  }
  const findings: Finding[] = []
  for (const pkg of loaded.packages) {
    const testsDir = joinPath(pkg.dir, 'tests')
    const commonDir = joinPath(testsDir, 'common')
    const nestedPackages = loaded.packages.filter(p => p !== pkg && isUnder(p.dir, pkg.dir) && p.dir !== pkg.dir)
    const owned = (f: string): boolean => isUnder(f, pkg.dir) && !nestedPackages.some(p => isUnder(f, p.dir))
    const roots = new Set(pkg.roots)
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
    for (const file of rustFiles) {
      if (!owned(file)) {
        continue
      }
      if (isUnder(file, testsDir)) {
        const inner = relativeTo(file, testsDir).split('/')
        const inTargetDir = inner.length > 1 && fileSet.has(joinPath(testsDir, inner[0] ?? '', 'main.rs'))
        if (!roots.has(file) && !reachedByAny.has(file) && !isUnder(file, commonDir) && !inTargetDir) {
          findings.push({
            slug: 'test-path-derivable-from-source',
            kind: 'undiscovered-integration-test',
            severity: 'warning',
            language: 'rust',
            file,
            message: 'Cargo does not compile this file: it is not a test target and no test target loads it with `mod`. Move it to tests/<name>.rs (or tests/<name>/main.rs), or register it with a [[test]] entry in Cargo.toml.',
          })
        }
        const users = fromTarget.get(file)
        if (users != null && users.size >= 2 && !isUnder(file, commonDir)) {
          findings.push({
            slug: 'test-helpers-in-dedicated-location',
            kind: 'shared-helper-outside-location',
            severity: 'warning',
            language: 'rust',
            file,
            message: `Helper module is shared by ${users.size} test targets (${[...users].sort().slice(0, 3).join(', ')}) but lives outside ${commonDir}/. Move it to ${commonDir}/mod.rs (or a submodule) and load it with \`mod common;\`.`,
          })
        }
      }
      else if (unitTestFiles.has(file) && !roots.has(file) && !reachedByAny.has(file)) {
        findings.push({
          slug: 'test-path-derivable-from-source',
          kind: 'unreachable-unit-test',
          severity: 'warning',
          language: 'rust',
          file,
          message: 'File has #[test] functions but no target reaches it through `mod` declarations, so they never run. Declare it from its source module (`#[cfg(test)] mod tests;` or `#[cfg(test)] #[path = "…"] mod tests;`).',
        })
      }
    }
  }
  return { findings, notices: loaded.notices }
}
