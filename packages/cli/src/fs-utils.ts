import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

export interface PackageJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  prettier?: string | Record<string, unknown>
  [key: string]: unknown
}

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm'

const PM_LOCKFILES: Array<{ pm: PackageManager, files: string[] }> = [
  { pm: 'bun', files: ['bun.lock', 'bun.lockb'] },
  { pm: 'pnpm', files: ['pnpm-lock.yaml'] },
  { pm: 'yarn', files: ['yarn.lock'] },
  { pm: 'npm', files: ['package-lock.json'] },
]

export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  for (const { pm, files } of PM_LOCKFILES) {
    if (files.some(f => existsSync(resolve(cwd, f)))) {
      return pm
    }
  }
  // PleaseAI default — this CLI is Bun-first.
  return 'bun'
}

export function installCommand(pm: PackageManager, packages: string[]): [string, string[]] {
  switch (pm) {
    case 'bun':
      return ['bun', ['add', '-d', ...packages]]
    case 'pnpm':
      return ['pnpm', ['add', '-D', ...packages]]
    case 'yarn':
      return ['yarn', ['add', '-D', ...packages]]
    case 'npm':
      return ['npm', ['install', '-D', ...packages]]
  }
}

export function readPackageJson(cwd: string = process.cwd()): PackageJson {
  const pkgPath = resolve(cwd, 'package.json')
  return JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson
}

export function writePackageJson(pkg: PackageJson, cwd: string = process.cwd()): void {
  const pkgPath = resolve(cwd, 'package.json')
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

export function isPackageInstalled(pkg: PackageJson, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name])
}

/**
 * Marker block helpers for AGENTS.md (and any other marker-managed markdown).
 *
 * The CLI owns only the content *between* the markers — anything else in the
 * file is user content and is preserved verbatim.
 */
const BEGIN_MARKER = '<!-- pleaseai-code-style:start -->'
const END_MARKER = '<!-- pleaseai-code-style:end -->'

export function buildMarkerBlock(body: string): string {
  return `${BEGIN_MARKER}\n${body.trim()}\n${END_MARKER}`
}

export function upsertMarkerBlock(existing: string | null, body: string): string {
  const block = buildMarkerBlock(body)
  if (existing == null) {
    return `${block}\n`
  }

  const begin = existing.indexOf(BEGIN_MARKER)
  const end = existing.indexOf(END_MARKER)
  if (begin !== -1 && end !== -1 && end > begin) {
    const before = existing.slice(0, begin)
    const after = existing.slice(end + END_MARKER.length)
    return `${before}${block}${after}`
  }
  // No marker block yet — append with spacing.
  const sep = existing.endsWith('\n') ? '\n' : '\n\n'
  return `${existing}${sep}${block}\n`
}

export function readFileOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  }
  catch {
    return null
  }
}
