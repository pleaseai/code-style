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

// A workspace entry: `"<path>": {` followed by its `name` and `version`.
// `\r?\n` keeps a CRLF checkout matching; `head` carries its line endings over.
const workspaceEntry = /^( {4}"([^"]+)": \{\r?\n {6}"name": "[^"]+",\r?\n {6}"version": ")([^"]+)(")/gm

let matched = 0
let changed = 0
const next = lock.replace(workspaceEntry, (match, head: string, path: string, locked: string, tail: string) => {
  matched++
  const { version } = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')) as { version?: string }
  if (!version || version === locked) {
    return match
  }
  changed++
  process.stdout.write(`${path}: ${locked} -> ${version}\n`)
  return `${head}${version}${tail}`
})

// Matching nothing means bun.lock changed shape, not that it is in sync: fail
// rather than let a release ship with stale workspace versions.
if (matched === 0) {
  process.stderr.write(`no workspace entries matched in ${lockPath}\n`)
  process.exit(1)
}

if (changed > 0) {
  writeFileSync(lockPath, next)
}
