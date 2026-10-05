import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'bun:test'
import { listFiles } from '../../src/check/list-files.js'
import { createFixture } from '../test-utils/fixture.js'

function git(cwd: string, ...args: string[]): void {
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf-8' })
}

describe('listFiles', () => {
  test('lists a conflicted path once, not once per index stage', () => {
    const fixture = createFixture({ 'a.txt': 'base\n' })
    try {
      git(fixture.root, 'init', '-q', '-b', 'main')
      git(fixture.root, 'add', '.')
      git(fixture.root, 'commit', '-q', '-m', 'base')
      git(fixture.root, 'checkout', '-q', '-b', 'other')
      spawnSync('sh', ['-c', 'echo other > a.txt'], { cwd: fixture.root })
      git(fixture.root, 'commit', '-qam', 'other')
      git(fixture.root, 'checkout', '-q', 'main')
      spawnSync('sh', ['-c', 'echo main > a.txt'], { cwd: fixture.root })
      git(fixture.root, 'commit', '-qam', 'main')
      git(fixture.root, 'merge', 'other')
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
})
