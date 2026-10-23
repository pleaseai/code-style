import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readMarkerBlock } from './fs-utils.js'

export const LANGUAGES = ['typescript', 'dart', 'rust', 'java', 'go', 'python', 'ruby', 'csharp', 'html-css'] as const

export type Language = typeof LANGUAGES[number]

export const GUIDES_DIR = '.agents/code-style'

const LEGACY_GUIDES_DIR = 'node_modules/@pleaseai/code-style/rules'

const MARKERS: Array<{ language: Language, files: string[] }> = [
  { language: 'typescript', files: ['package.json', 'tsconfig.json'] },
  { language: 'dart', files: ['pubspec.yaml'] },
  { language: 'rust', files: ['Cargo.toml'] },
  { language: 'java', files: ['build.gradle', 'build.gradle.kts', 'pom.xml'] },
  { language: 'go', files: ['go.mod'] },
  { language: 'python', files: ['pyproject.toml'] },
]

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value)
}

function inOrder(languages: Iterable<Language>): Language[] {
  const set = new Set(languages)
  return LANGUAGES.filter(language => set.has(language))
}

export function detectLanguages(cwd: string): Language[] {
  return inOrder(MARKERS
    .filter(({ files }) => files.some(f => existsSync(resolve(cwd, f))))
    .map(({ language }) => language))
}

export type LangFlag
  = | { kind: 'none' }
    | { kind: 'languages', languages: Language[] }
    | { kind: 'invalid', value: string }

const LEGACY_LOCALE_ALIASES: ReadonlyArray<string | boolean> = ['ko', 'en']

export function parseLangFlag(value: string | boolean | undefined): LangFlag {
  if (value === undefined || LEGACY_LOCALE_ALIASES.includes(value)) {
    return { kind: 'none' }
  }
  if (typeof value !== 'string') {
    return { kind: 'invalid', value: '' }
  }
  const items = value.split(',').map(item => item.trim()).filter(item => item !== '')
  if (items.length === 0 || !items.every(isLanguage)) {
    return { kind: 'invalid', value }
  }
  return { kind: 'languages', languages: inOrder(items) }
}

function linksGuide(block: string, id: string): boolean {
  return block.includes(`${GUIDES_DIR}/${id}.md`) || block.includes(`${LEGACY_GUIDES_DIR}/${id}.md`)
}

function isLanguageAwareBlock(block: string | undefined): block is string {
  return block !== undefined && linksGuide(block, 'general')
}

export function languagesFromAgentsBlock(content: string | null): Language[] | undefined {
  const block = content == null ? undefined : readMarkerBlock(content)
  if (!isLanguageAwareBlock(block)) {
    return undefined
  }
  return LANGUAGES.filter(language => linksGuide(block, language))
}
