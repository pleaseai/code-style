import type { SpawnSyncReturns } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, test } from 'bun:test'
import { listFiles } from '../../src/check/list-files.js'
import { createFixture } from '../test-utils/fixture.js'

function git(cwd: string, ...args: string[]): SpawnSyncReturns<string> {
  return spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf-8' })
}

describe('listFiles', () => {
  test('lists a conflicted path once, not once per index stage', () => {
    const fixture = createFixture({ 'a.txt': 'base\n' })
    try {
      git(fixture.root, 'init', '-q', '-b', 'main')
      git(fixture.root, 'add', '.')
      git(fixture.root, 'commit', '-q', '-m', 'base')
      git(fixture.root, 'checkout', '-q', '-b', 'other')
      writeFileSync(join(fixture.root, 'a.txt'), 'other\n')
      git(fixture.root, 'commit', '-qam', 'other')
      git(fixture.root, 'checkout', '-q', 'main')
      writeFileSync(join(fixture.root, 'a.txt'), 'main\n')
      git(fixture.root, 'commit', '-qam', 'main')
      expect(git(fixture.root, 'merge', 'other').status).not.toBe(0)
      // Stages 1-3 of the conflicted path are all in the index.
      expect(git(fixture.root, 'ls-files', '--stage').stdout.trim().split('\n')).toHaveLength(3)
      expect(listFiles(fixture.root)).toEqual(['a.txt'])
    }
    finally {
      fixture.cleanup()
    }
  })

  test('skips third-party vendor/ and Pods/ directories, tracked or not', () => {
    const fixture = createFixture({ 'src/a.ts': '', 'vendor/lib/thing.ts': '', 'ios/Pods/Dep/dep.swift': '' })
    try {
      expect(listFiles(fixture.root)).toEqual(['src/a.ts'])
      git(fixture.root, 'init', '-q', '-b', 'main')
      git(fixture.root, 'add', '-f', '.')
      expect(listFiles(fixture.root)).toEqual(['src/a.ts'])
    }
    finally {
      fixture.cleanup()
    }
  })
  test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('skips an unreadable directory outside a git work tree', () => {
    const fixture = createFixture({ 'src/a.ts': '', 'locked/b.ts': '' })
    const locked = join(fixture.root, 'locked')
    try {
      chmodSync(locked, 0o000)
      expect(listFiles(fixture.root)).toEqual(['src/a.ts'])
    }
    finally {
      chmodSync(locked, 0o755)
      fixture.cleanup()
    }
  })
})
