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
const workspaceEntry = /^( {4}"([^"]+)": \{\n {6}"name": "[^"]+",\n {6}"version": ")([^"]+)(")/gm

let changed = 0
const next = lock.replace(workspaceEntry, (match, head: string, path: string, locked: string, tail: string) => {
  const { version } = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')) as { version?: string }
  if (!version || version === locked) {
    return match
  }
  changed++
  process.stdout.write(`${path}: ${locked} -> ${version}\n`)
  return `${head}${version}${tail}`
})

if (changed > 0) {
  writeFileSync(lockPath, next)
}
