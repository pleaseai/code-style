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

/** Matches in `fileSet` only: ast-grep's own walker does not know about ignored directories. */
function extract(root: string, files: string[], fileSet: Set<string>, language: ExtractLanguage): ExtractMatch[] {
  return files.some(f => EXTENSIONS[language].test(f))
    ? runExtraction(root, language).filter(m => fileSet.has(m.file))
    : []
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
