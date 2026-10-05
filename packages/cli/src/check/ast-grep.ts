import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { AstGrepError, MissingDependencyError } from './errors.js'

/** Extraction rule files shipped in `extract/`, one per ast-grep language. */
export type ExtractLanguage = 'typescript' | 'tsx' | 'dart' | 'kotlin' | 'java' | 'rust'

/** One extraction match: the name node a rule in `extract/<lang>.yml` matched. */
export interface ExtractMatch {
  ruleId: string
  /** Path relative to the scanned root, `/`-separated. */
  file: string
  /** 1-based line of the match. */
  line: number
  text: string
  /** Captured single metavariables (`$SRC`, `$PATH`), when the rule has any. */
  vars: Record<string, string>
}

interface RawMatch {
  ruleId: string
  file: string
  text: string
  range: { start: { line: number } }
  metaVariables?: { single?: Record<string, { text: string }> }
}

const MISSING_BINARY = 'cannot resolve @ast-grep/cli from the checked project or this CLI. '
  + 'Install it as a devDependency of the checked project: bun add -D @ast-grep/cli'
const MISSING_CONFIG = 'cannot resolve @pleaseai/ast-grep-config from this CLI or the checked project. '
  + 'It ships with @pleaseai/code-style; reinstall the CLI'

/** The ast-grep binary and the directory holding the extraction rules. */
export interface Toolchain {
  bin: string
  extractDir: string
}

/**
 * Resolution anchors for `root`: the checked project first (its own pinned
 * ast-grep version wins), then this CLI's install as a fallback.
 */
export function resolutionAnchors(root: string): string[] {
  return [join(root, 'package.json'), fileURLToPath(import.meta.url)]
}

function packageDir(name: string, anchor: string): string | null {
  try {
    return dirname(createRequire(anchor).resolve(`${name}/package.json`))
  }
  catch {
    return null
  }
}

/**
 * Locates the native ast-grep binary from `@ast-grep/cli` as seen from
 * `anchor`. Goes straight to the platform binary so a package manager that
 * blocked the postinstall step (bun does by default) does not add a warning
 * per call.
 */
function astGrepBinary(anchor: string): string | null {
  const cliDir = packageDir('@ast-grep/cli', anchor)
  if (cliDir == null) {
    return null
  }
  try {
    const { resolveBinaryPath } = createRequire(anchor)(join(cliDir, 'postinstall.js')) as {
      resolveBinaryPath: () => string | null
    }
    const native = resolveBinaryPath()
    if (native != null && existsSync(native)) {
      return native
    }
  }
  catch {
    // Fall through to the shim.
  }
  const shim = join(cliDir, process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep')
  return existsSync(shim) ? shim : null
}

function firstResolved(anchors: string[], resolve: (anchor: string) => string | null): string | null {
  for (const anchor of anchors) {
    const found = resolve(anchor)
    if (found != null) {
      return found
    }
  }
  return null
}

/**
 * Resolves the ast-grep binary and `@pleaseai/ast-grep-config/extract`.
 * The binary tries `anchors` in order (project first). The extract rules are an
 * implementation detail of `check` and must match this CLI's code, so they try
 * the anchors in reverse (this CLI's own copy first); the project's copy only
 * serves lint `rules/` and is a last-resort fallback here.
 */
export function resolveToolchain(anchors: string[]): Toolchain {
  const bin = firstResolved(anchors, astGrepBinary)
  if (bin == null) {
    throw new MissingDependencyError(MISSING_BINARY)
  }
  const configDir = firstResolved([...anchors].reverse(), anchor => packageDir('@pleaseai/ast-grep-config', anchor))
  if (configDir == null) {
    throw new MissingDependencyError(MISSING_CONFIG)
  }
  return { bin, extractDir: join(configDir, 'extract') }
}

/** Runs `extract/<language>.yml` over `root` and returns every match. */
export function runExtraction(root: string, language: ExtractLanguage, paths: string[] = ['.']): ExtractMatch[] {
  const { bin, extractDir } = resolveToolchain(resolutionAnchors(root))
  const ruleFile = join(extractDir, `${language}.yml`)
  const res = spawnSync(bin, ['scan', '-c', join(extractDir, 'sgconfig.yml'), '--rule', ruleFile, '--json=stream', ...paths], {
    cwd: root,
    encoding: 'utf-8',
    maxBuffer: 512 * 1024 * 1024,
  })
  if (res.error != null) {
    throw new AstGrepError(`failed to run ast-grep (${bin}): ${res.error.message}`)
  }
  if (res.status !== 0) {
    throw new AstGrepError(`ast-grep exited with ${res.status}: ${res.stderr.trim()}`)
  }
  const matches: ExtractMatch[] = []
  for (const line of res.stdout.split('\n')) {
    if (line.trim() === '') {
      continue
    }
    const raw = JSON.parse(line) as RawMatch
    const vars: Record<string, string> = {}
    for (const [name, value] of Object.entries(raw.metaVariables?.single ?? {})) {
      vars[name] = value.text
    }
    matches.push({
      ruleId: raw.ruleId,
      file: raw.file.split('\\').join('/').replace(/^\.\//, ''),
      line: raw.range.start.line + 1,
      text: raw.text,
      vars,
    })
  }
  return matches
}
