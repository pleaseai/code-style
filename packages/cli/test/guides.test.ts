import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { guidePath, syncGuides } from '../src/guides.js'
import { LANGUAGES } from '../src/languages.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-guides-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('guidePath', () => {
  test('points at the guide inside .agents/code-style', () => {
    expect(guidePath('dart')).toBe('.agents/code-style/dart.md')
  })
})

describe('syncGuides', () => {
  test('copies general, the selected guides and the attribution files', () => {
    for (const languages of [['dart', 'rust'], [...LANGUAGES]] as const) {
      rmSync(join(dir, '.agents'), { recursive: true, force: true })
      syncGuides(dir, [...languages])
      for (const name of ['general.md', ...languages.map(language => `${language}.md`), 'NOTICE.md', 'LICENSE-Apache-2.0.txt']) {
        const shipped = readFileSync(join(import.meta.dir, '../rules', name), 'utf-8')
        expect(readFileSync(join(dir, '.agents/code-style', name), 'utf-8')).toBe(shipped)
      }
    }
  })

  test('reports nothing on a second sync with identical inputs', () => {
    const first = syncGuides(dir, ['dart'])
    expect(first.created.length).toBeGreaterThan(0)
    expect(syncGuides(dir, ['dart'])).toEqual({ created: [], updated: [] })
  })

  test('removes the guide of a deselected language and leaves other files alone', () => {
    syncGuides(dir, ['dart', 'rust'])
    writeFileSync(join(dir, '.agents/code-style/team-notes.md'), 'mine')
    writeFileSync(join(dir, '.agents/code-style/dart.md'), 'stale')
    const result = syncGuides(dir, ['rust'])
    expect(existsSync(join(dir, '.agents/code-style/dart.md'))).toBe(false)
    expect(existsSync(join(dir, '.agents/code-style/rust.md'))).toBe(true)
    expect(readFileSync(join(dir, '.agents/code-style/team-notes.md'), 'utf-8')).toBe('mine')
    expect(result.updated).toContain('.agents/code-style/dart.md (removed)')
  })

  test('refreshes a modified guide from the package copy', () => {
    syncGuides(dir, ['dart'])
    writeFileSync(join(dir, '.agents/code-style/general.md'), 'edited')
    const result = syncGuides(dir, ['dart'])
    const shipped = readFileSync(join(import.meta.dir, '../rules/general.md'), 'utf-8')
    expect(readFileSync(join(dir, '.agents/code-style/general.md'), 'utf-8')).toBe(shipped)
    expect(result.updated).toEqual(['.agents/code-style/general.md'])
  })

  test('refuses to write a guide through a symlinked file or directory', () => {
    const outside = mkdtempSync(join(tmpdir(), 'pleaseai-cli-outside-'))
    try {
      writeFileSync(join(outside, 'target.md'), 'outside')
      mkdirSync(join(dir, '.agents/code-style'), { recursive: true })
      symlinkSync(join(outside, 'target.md'), join(dir, '.agents/code-style/general.md'))
      expect(() => syncGuides(dir, ['dart'])).toThrow('.agents/code-style/general.md is a symlink')
      expect(readFileSync(join(outside, 'target.md'), 'utf-8')).toBe('outside')

      rmSync(join(dir, '.agents/code-style/general.md'))
      symlinkSync(join(outside, 'target.md'), join(dir, '.agents/code-style/NOTICE.md'))
      expect(() => syncGuides(dir, ['dart'])).toThrow('.agents/code-style/NOTICE.md is a symlink')
      expect(existsSync(join(dir, '.agents/code-style/general.md'))).toBe(false)

      rmSync(join(dir, '.agents'), { recursive: true, force: true })
      symlinkSync(outside, join(dir, '.agents'))
      expect(() => syncGuides(dir, ['dart'])).toThrow('.agents is a symlink')
      expect(existsSync(join(outside, 'code-style'))).toBe(false)
    }
    finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('unlinks a symlinked guide of a deselected language without touching its target', () => {
    const outside = mkdtempSync(join(tmpdir(), 'pleaseai-cli-outside-'))
    try {
      writeFileSync(join(outside, 'target.md'), 'outside')
      mkdirSync(join(dir, '.agents/code-style'), { recursive: true })
      symlinkSync(join(outside, 'target.md'), join(dir, '.agents/code-style/rust.md'))
      symlinkSync(join(outside, 'gone.md'), join(dir, '.agents/code-style/go.md'))
      const { updated } = syncGuides(dir, ['dart'])
      expect(updated).toContain('.agents/code-style/rust.md (removed)')
      expect(updated).toContain('.agents/code-style/go.md (removed)')
      expect(lstatSync(join(dir, '.agents/code-style/rust.md'), { throwIfNoEntry: false })).toBeUndefined()
      expect(lstatSync(join(dir, '.agents/code-style/go.md'), { throwIfNoEntry: false })).toBeUndefined()
      expect(readFileSync(join(outside, 'target.md'), 'utf-8')).toBe('outside')
    }
    finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('ships a guide for every language, covered by the package files', () => {
    const pkgRoot = join(import.meta.dir, '..')
    const { files } = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8')) as { files: string[] }
    for (const id of LANGUAGES) {
      const path = `rules/${id}.md`
      expect(existsSync(join(pkgRoot, path))).toBe(true)
      expect(files.some(entry => path.startsWith(`${entry}/`))).toBe(true)
    }
  })
})
