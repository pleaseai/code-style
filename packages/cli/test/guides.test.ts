import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
        expect(existsSync(join(dir, '.agents/code-style', name))).toBe(true)
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
