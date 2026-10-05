import type { Dirent } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Third-party source directories skipped everywhere, tracked or not. */
const IGNORED_THIRD_PARTY = new Set(['vendor', 'Pods'])

/** Directories never walked when the root is not a git work tree. */
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'target',
  'coverage',
  'out',
  '.nuxt',
  '.output',
  '.dart_tool',
  '.gradle',
  '.idea',
  '.turbo',
  '.cache',
  ...IGNORED_THIRD_PARTY,
])

function walk(root: string, dir: string, out: string[]): void {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    // An unreadable directory (permissions, removed mid-walk) is skipped, not fatal.
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walk(root, join(dir, entry.name), out)
      }
    }
    else if (entry.isFile()) {
      out.push(relative(root, join(dir, entry.name)).split('\\').join('/'))
    }
  }
}

/**
 * Lists files under `root`, relative and `/`-separated. Inside a git work tree
 * this is tracked plus untracked-but-not-ignored files (what ast-grep scans);
 * elsewhere it walks the tree, skipping build and dependency directories.
 */
export function listFiles(root: string): string[] {
  const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024,
  })
  if (git.status === 0) {
    // `--cached` still lists tracked files deleted from the work tree.
    // An unmerged path is listed once per index stage.
    return [...new Set(git.stdout.split('\0'))].filter(f => f !== '' && !f.split('/').slice(0, -1).some(seg => IGNORED_THIRD_PARTY.has(seg)) && existsSync(join(root, f))).sort()
  }
  const out: string[] = []
  walk(root, root, out)
  return out.sort()
}
