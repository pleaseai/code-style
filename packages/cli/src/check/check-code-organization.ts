import type { ExtractLanguage, ExtractMatch } from './ast-grep.js'
import type { CheckOptions, CheckResult, Finding } from './types.js'
import { existsSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { runExtraction } from './ast-grep.js'
import { checkFilenames, dartFilenames, typescriptFilenames } from './check-filenames.js'
import { checkHelpers, dartHelpers, jvmHelpers, typescriptHelpers } from './check-helpers.js'
import { checkRust } from './check-rust.js'
import { checkTestPaths } from './check-test-paths.js'
import { CONFIG_FILE, readConfigFile } from './config.js'
import { ConfigError } from './errors.js'
import { DART_LAYOUT, JAVA_LAYOUT, KOTLIN_LAYOUT, TEST_LAYOUTS, TYPESCRIPT_LAYOUT } from './layouts.js'
import { listFiles } from './list-files.js'

const EXTENSIONS: Record<ExtractLanguage, RegExp> = {
  typescript: /\.(?:ts|mts|cts)$/,
  tsx: /\.tsx$/,
  dart: /\.dart$/,
  kotlin: /\.kts?$/,
  java: /\.java$/,
  rust: /\.rs$/,
}

/** Paths per ast-grep invocation, kept well under OS argv limits. */
const BATCH_SIZE = 200

/**
 * Matches in the listed files of `language`. The files are passed to ast-grep
 * explicitly: its own directory walker skips hidden directories and
 * gitignore-matched paths (listed tracked files included) and descends
 * `node_modules` outside a git work tree. Explicit paths bypass that filtering.
 */
function extract(root: string, files: string[], fileSet: Set<string>, language: ExtractLanguage): ExtractMatch[] {
  const paths = files.filter(f => EXTENSIONS[language].test(f)).map(f => (f.startsWith('-') ? `./${f}` : f))
  const out: ExtractMatch[] = []
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    out.push(...runExtraction(root, language, paths.slice(i, i + BATCH_SIZE)).filter(m => fileSet.has(m.file)))
  }
  return out
}

/**
 * Runs the ADR-0022 layer-3 path checker over `options.root`. Never throws for
 * findings — every finding is a warning; callers decide the exit code.
 */
export function checkCodeOrganization(options: CheckOptions = {}): CheckResult {
  const root = realpathSync(resolve(options.root ?? process.cwd()))
  if (options.configPath != null && !existsSync(options.configPath)) {
    throw new ConfigError(`config file not found: ${options.configPath}`)
  }
  const base = readConfigFile(options.configPath ?? join(root, CONFIG_FILE))
  const files = listFiles(root)
  const fileSet = new Set(files)

  const ts = [...extract(root, files, fileSet, 'typescript'), ...extract(root, files, fileSet, 'tsx')]
  const dart = extract(root, files, fileSet, 'dart')
  const kotlin = extract(root, files, fileSet, 'kotlin')
  const java = extract(root, files, fileSet, 'java')
  const rust = extract(root, files, fileSet, 'rust')

  const tsUnits = TYPESCRIPT_LAYOUT.units(files, base, root)
  const dartUnits = DART_LAYOUT.units(files, base, root)
  const dartParts = new Set(dart.filter(m => m.ruleId === 'part-of').map(m => m.file))

  const findings: Finding[] = [
    ...checkTestPaths(files, TEST_LAYOUTS, base, root),
    ...checkFilenames(ts, typescriptFilenames(tsUnits)),
    ...checkFilenames(dart, dartFilenames(dartUnits, dartParts)),
    ...checkHelpers(typescriptHelpers(TYPESCRIPT_LAYOUT, tsUnits, ts, fileSet)),
    ...checkHelpers(dartHelpers(DART_LAYOUT, dartUnits, dart, fileSet)),
    ...checkHelpers(jvmHelpers(KOTLIN_LAYOUT, KOTLIN_LAYOUT.units(files, base, root), kotlin, files, root)),
    ...checkHelpers(jvmHelpers(JAVA_LAYOUT, JAVA_LAYOUT.units(files, base, root), java, files, root)),
  ]
  const rustResult = checkRust(root, files, rust, options.cargoMetadata)
  findings.push(...rustResult.findings)

  findings.sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.slug.localeCompare(b.slug))
  return { root, findings, notices: rustResult.notices }
}
