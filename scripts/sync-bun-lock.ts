/**
 * Syncs each workspace's `version` in bun.lock with its package.json.
 *
 * `bun pm pack` resolves `workspace:*` dependencies from the version bun.lock
 * recorded, and `bun install` does not refresh it after a version bump.
 * release-please bumps package.json only (googleapis/release-please#2689), so
 * the release workflow runs this on the release PR branch. Without it the
 * published CLI pins `@pleaseai/ast-grep-config` to a version that was never
 * released.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const root = join(import.meta.dirname, '..')
const lockPath = join(root, 'bun.lock')
const lock = readFileSync(lockPath, 'utf8')

function packageVersion(path: string): string | undefined {
  return (JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')) as { version?: string }).version
}

// A workspace entry: `"<path>": {` followed by its `name` and `version`.
// `\r?\n` keeps a CRLF checkout matching; `head` carries its line endings over.
const workspaceEntry = /^( {4}"([^"]+)": \{\r?\n {6}"name": "[^"]+",\r?\n {6}"version": ")([^"]+)(")/gm

let changed = 0
const next = lock.replace(workspaceEntry, (match, head: string, path: string, locked: string, tail: string) => {
  const version = packageVersion(path)
  if (!version || version === locked) {
    return match
  }
  changed++
  process.stdout.write(`${path}: ${locked} -> ${version}\n`)
  return `${head}${version}${tail}`
})

// The rewrite is textual, so an entry whose shape it does not expect is skipped
// silently. Check the result as data instead: fail rather than let a release
// ship with a stale workspace version.
const { workspaces } = Bun.JSONC.parse(next) as { workspaces: Record<string, { version?: string }> }
// The root (`""`) never carries a version in bun.lock.
const stale = Object.entries(workspaces).filter(([path, { version }]) => {
  const expected = path === '' ? undefined : packageVersion(path)
  return expected !== undefined && version !== expected
})
if (stale.length > 0) {
  for (const [path, { version }] of stale) {
    process.stderr.write(`${path}: bun.lock has ${version ?? 'no version'}, package.json has ${packageVersion(path)}\n`)
  }
  process.exit(1)
}

if (changed > 0) {
  writeFileSync(lockPath, next)
}
