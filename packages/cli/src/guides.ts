import type { Language } from './languages.js'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUIDES_DIR, LANGUAGES } from './languages.js'

const PACKAGE_RULES = fileURLToPath(new URL('../rules/', import.meta.url))

// Attribution for guides adapted from CC BY / Apache-2.0 sources travels with them.
const ATTRIBUTION_FILES = ['NOTICE.md', 'LICENSE-Apache-2.0.txt']

export interface GuidesResult {
  created: string[]
  updated: string[]
}

export function guidePath(id: string): string {
  return `${GUIDES_DIR}/${id}.md`
}

export function syncGuides(cwd: string, languages: Language[]): GuidesResult {
  const result: GuidesResult = { created: [], updated: [] }
  const dir = resolve(cwd, GUIDES_DIR)
  mkdirSync(dir, { recursive: true })

  const names = ['general.md', ...languages.map(language => `${language}.md`), ...ATTRIBUTION_FILES]
  for (const name of names) {
    const source = readFileSync(resolve(PACKAGE_RULES, name))
    const target = resolve(dir, name)
    const label = `${GUIDES_DIR}/${name}`
    if (!existsSync(target)) {
      writeFileSync(target, source)
      result.created.push(label)
    }
    else if (!readFileSync(target).equals(source)) {
      writeFileSync(target, source)
      result.updated.push(label)
    }
  }

  for (const language of LANGUAGES) {
    const target = resolve(dir, `${language}.md`)
    if (!languages.includes(language) && existsSync(target)) {
      rmSync(target)
      result.updated.push(`${GUIDES_DIR}/${language}.md (removed)`)
    }
  }
  return result
}
