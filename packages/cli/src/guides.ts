import type { Language } from './languages.js'
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { t } from './i18n.js'
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

// A committed symlink would redirect guide writes and deletions outside the project.
function assertNotSymlink(cwd: string, path: string): void {
  if (lstatSync(resolve(cwd, path), { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(t('guideSymlink')(path))
  }
}

function guideNames(languages: Language[]): string[] {
  return ['general.md', ...languages.map(language => `${language}.md`), ...ATTRIBUTION_FILES]
}

// Removing a deselected guide only unlinks a symlink, so only the written paths are checked.
export function assertGuidesWritable(cwd: string, languages: Language[]): void {
  for (const path of ['.agents', GUIDES_DIR, ...guideNames(languages).map(name => `${GUIDES_DIR}/${name}`)]) {
    assertNotSymlink(cwd, path)
  }
}

export function syncGuides(cwd: string, languages: Language[]): GuidesResult {
  const result: GuidesResult = { created: [], updated: [] }
  assertGuidesWritable(cwd, languages)
  const names = guideNames(languages)
  const removed = LANGUAGES.filter(language => !languages.includes(language)).map(language => `${GUIDES_DIR}/${language}.md`)
  const dir = resolve(cwd, GUIDES_DIR)
  mkdirSync(dir, { recursive: true })

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

  for (const label of removed) {
    const target = resolve(cwd, label)
    // lstat, unlike existsSync, also sees a dangling symlink.
    if (lstatSync(target, { throwIfNoEntry: false }) !== undefined) {
      rmSync(target)
      result.updated.push(`${label} (removed)`)
    }
  }
  return result
}
