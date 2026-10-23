import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { detectLanguages, languagesFromAgentsBlock, parseLangFlag } from '../src/languages.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pleaseai-lang-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function touch(...files: string[]): void {
  for (const f of files) {
    writeFileSync(join(dir, f), '')
  }
}

describe('detectLanguages', () => {
  test.each([
    ['package.json', 'typescript'],
    ['tsconfig.json', 'typescript'],
    ['build.gradle', 'java'],
    ['build.gradle.kts', 'java'],
    ['pom.xml', 'java'],
    ['pubspec.yaml', 'dart'],
    ['Cargo.toml', 'rust'],
    ['go.mod', 'go'],
    ['pyproject.toml', 'python'],
  ])('%s marks %s', (marker, language) => {
    touch(marker)
    expect<string[]>(detectLanguages(dir)).toEqual([language])
  })

  test('reports every language with a root marker, in guide order', () => {
    touch('pubspec.yaml', 'package.json')
    expect(detectLanguages(dir)).toEqual(['typescript', 'dart'])
  })

  test('returns nothing without a marker', () => {
    expect(detectLanguages(dir)).toEqual([])
  })
})

describe('parseLangFlag', () => {
  test('an unset flag and the locale aliases select no languages', () => {
    expect(parseLangFlag(undefined)).toEqual({ kind: 'none' })
    expect(parseLangFlag('ko')).toEqual({ kind: 'none' })
    expect(parseLangFlag('en')).toEqual({ kind: 'none' })
  })

  test('a list is trimmed, deduped, and ordered as the guides', () => {
    expect(parseLangFlag('dart')).toEqual({ kind: 'languages', languages: ['dart'] })
    expect(parseLangFlag(' rust, typescript,,rust ')).toEqual({ kind: 'languages', languages: ['typescript', 'rust'] })
  })

  test('an unknown item, an empty list, or a missing value is invalid', () => {
    expect(parseLangFlag('dart,foo')).toEqual({ kind: 'invalid', value: 'dart,foo' })
    expect(parseLangFlag(',')).toEqual({ kind: 'invalid', value: ',' })
    expect(parseLangFlag(true)).toEqual({ kind: 'invalid', value: '' })
  })

  test('ko or en inside a list is invalid', () => {
    expect(parseLangFlag('ko,dart')).toEqual({ kind: 'invalid', value: 'ko,dart' })
  })
})

describe('languagesFromAgentsBlock', () => {
  const block = (body: string): string => `<!-- pleaseai-code-style:start -->\n${body}\n<!-- pleaseai-code-style:end -->\n`
  const guide = (id: string): string => `.agents/code-style/${id}.md`
  const legacyGuide = (id: string): string => `node_modules/@pleaseai/code-style/rules/${id}.md`

  test('is undefined without a block', () => {
    expect(languagesFromAgentsBlock(null)).toBeUndefined()
    expect(languagesFromAgentsBlock(`see ${guide('general')} and ${guide('dart')}`)).toBeUndefined()
  })

  test('is undefined for a legacy block that does not link the general guide', () => {
    expect(languagesFromAgentsBlock(block(`read ${guide('typescript')}`))).toBeUndefined()
  })

  test('is undefined for the v0.1.1 block, so update falls back to detection', () => {
    const released = block('For the full rules (what an AI coding assistant needs to know before writing code),\nread `node_modules/@pleaseai/code-style/rules.md`.')
    expect(languagesFromAgentsBlock(released)).toBeUndefined()
  })

  test('lists the languages the block links', () => {
    expect(languagesFromAgentsBlock(block(`read ${guide('general')} and ${guide('dart')}`))).toEqual(['dart'])
    expect(languagesFromAgentsBlock(block(`read ${guide('general')}`))).toEqual([])
  })

  test('reads the links of a block written before the guides were copied into the project', () => {
    expect(languagesFromAgentsBlock(block(`read ${legacyGuide('general')} and ${legacyGuide('dart')}`))).toEqual(['dart'])
  })
})
