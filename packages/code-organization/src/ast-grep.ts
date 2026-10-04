import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { AstGrepError } from './errors.js'

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

const require = createRequire(import.meta.url)

/** Package root, from both `src/` (tests) and `dist/` (published build). */
export const PACKAGE_ROOT: string = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Locates the native ast-grep binary from the `@ast-grep/cli` dependency.
 * Goes straight to the platform binary so a package manager that blocked the
 * postinstall step (bun does by default) does not add a warning per call.
 */
export function resolveAstGrepBinary(): string {
  try {
    const cliDir = dirname(require.resolve('@ast-grep/cli/package.json'))
    const { resolveBinaryPath } = require(join(cliDir, 'postinstall.js')) as {
      resolveBinaryPath: () => string | null
    }
    const native = resolveBinaryPath()
    if (native != null && existsSync(native)) {
      return native
    }
    const shim = join(cliDir, process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep')
    if (existsSync(shim)) {
      return shim
    }
  }
  catch {
    // Fall through to PATH.
  }
  return 'ast-grep'
}

/** Runs `extract/<language>.yml` over `root` and returns every match. */
export function runExtraction(root: string, language: ExtractLanguage, paths: string[] = ['.']): ExtractMatch[] {
  const ruleFile = join(PACKAGE_ROOT, 'extract', `${language}.yml`)
  const bin = resolveAstGrepBinary()
  const res = spawnSync(bin, ['scan', '--rule', ruleFile, '--json=stream', ...paths], {
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
