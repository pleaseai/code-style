import type { CheckResult } from './types.js'
import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'

/** Files whose presence marks a project (package) root. */
const PROJECT_MARKERS = [
  'package.json',
  'pubspec.yaml',
  'Cargo.toml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'pom.xml',
]

/** Source-like file extensions a notice's example list can name. */
const SOURCE_PATH = /\.(?:ts|mts|cts|tsx|dart|kts?|java|rs|toml)$/

function hasMarker(dir: string): boolean {
  return PROJECT_MARKERS.some(m => existsSync(join(dir, m)))
}

function gitTopLevel(dir: string): string | null {
  const res = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf-8' })
  if (res.status !== 0 || res.stdout.trim() === '') {
    return null
  }
  try {
    return realpathSync(res.stdout.trim())
  }
  catch {
    return null
  }
}

/** The home directory with symlinks resolved, comparable with the realpath'd requested directory. */
function canonicalHome(): string {
  const home = homedir()
  try {
    return realpathSync(home)
  }
  catch {
    return home
  }
}

/**
 * The directory the whole check runs from. Package discovery needs the
 * enclosing project, so a requested subdirectory (`src/`, `test/`) resolves to
 * an ancestor holding a project marker. Inside a git work tree this is the
 * outermost marker up to the git top-level, so monorepo nesting and Cargo
 * workspaces resolve as when checking from the top; outside git it is the
 * nearest marker below the home directory and the filesystem root, so a stray
 * `~/package.json` is never adopted (and the home directory never walked).
 * With no marker found, the requested directory itself.
 */
export function findScanRoot(requested: string): string {
  const top = gitTopLevel(requested)
  const home = canonicalHome()
  let found: string | null = null
  for (let dir = requested; ; dir = dirname(dir)) {
    if (top == null && dir !== requested && (dir === home || dirname(dir) === dir)) {
      break
    }
    if (hasMarker(dir)) {
      found = dir
      if (top == null) {
        break
      }
    }
    if (dir === top || dirname(dir) === dir) {
      break
    }
  }
  return found ?? requested
}

/**
 * Relative path-like tokens in a notice: a directory or a source file.
 * Absolute paths are diagnostics (an executable, a temp file), not checked paths.
 */
function noticePaths(notice: string): string[] {
  return notice.split(/[\s,()`:;]+/).filter(tok => !tok.startsWith('/') && ((tok.includes('/') && !tok.includes('*')) || SOURCE_PATH.test(tok)))
}

/** Does `path` lie under `prefix`, or in a directory that contains it (a crate or package dir, a root-level file)? */
function relatesTo(path: string, prefix: string): boolean {
  const clean = path.replace(/^\.\//, '').replace(/\/$/, '')
  if (clean === '.' || clean === '' || clean === prefix || clean.startsWith(`${prefix}/`)) {
    return true
  }
  const dir = clean.includes('/') ? clean.slice(0, clean.lastIndexOf('/')) : ''
  return dir === '' || prefix === dir || prefix.startsWith(`${dir}/`) || prefix.startsWith(`${clean}/`)
}

/**
 * Narrows a result computed from `scanRoot` to the requested directory:
 * keeps the findings below it (re-relativized to it) and every notice that is
 * not provably about other directories only: one that mentions `<prefix>/`,
 * lists no relative path, truncates its example list, or names a path below or
 * above the requested directory. Tokenizing prose is approximate, so the
 * filter errs toward keeping a notice.
 */
export function scopeResult(result: CheckResult, scanRoot: string, requested: string): CheckResult {
  const prefix = relative(scanRoot, requested).split('\\').join('/')
  if (prefix === '') {
    return result
  }
  return {
    root: requested,
    findings: result.findings
      .filter(f => f.file.startsWith(`${prefix}/`))
      .map(f => ({ ...f, file: f.file.slice(prefix.length + 1) })),
    notices: result.notices.filter((n) => {
      const paths = noticePaths(n)
      return paths.length === 0 || n.includes('…') || n.includes(`${prefix}/`) || paths.some(p => relatesTo(p, prefix))
    }),
  }
}
