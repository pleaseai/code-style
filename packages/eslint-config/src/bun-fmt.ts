import type { OptionsConfig, OptionsFormatters, TypedFlatConfigItem } from '@antfu/eslint-config'
import type { Rule } from 'eslint'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { GLOB_MARKDOWN, GLOB_MARKDOWN_IN_MARKDOWN, parserPlain } from '@antfu/eslint-config'
import { messages, reportDifferences } from 'eslint-formatting-reporter'

const GLOB_MDX = '**/*.mdx'
/** MDX code blocks that antfu's Markdown processor extracts from `.md` files. */
const GLOB_MDX_IN_MARKDOWN = `${GLOB_MARKDOWN}/*.mdx`

/** `spawn` errors that mean the Bun binary itself cannot be started. */
const UNRUNNABLE_BUN_ERRORS = new Set(['ENOENT', 'EACCES'])

/**
 * Code blocks and MDX JSX stay with the ESLint rules that already lint them,
 * which would otherwise fight Prettier-style semicolons and quotes.
 * `--no-script` keeps a project `fmt` script from replacing the formatter.
 */
const BUN_FMT_ARGS = ['fmt', '--no-script', '--embedded-language-formatting=off']

export interface PleaseaiFormatters extends Omit<OptionsFormatters, 'markdown'> {
  /**
   * Enable formatting support for Markdown.
   *
   * `'bun'` formats `.md` and `.mdx` with `bun fmt`, which needs Bun 1.4.4
   * or later on `PATH`. `'prettier'`, `'dprint'` and `true` go to antfu.
   */
  markdown?: OptionsFormatters['markdown'] | 'bun'
}

export type BunFmtResult = { ok: true, code: string } | { ok: false, message: string }

export interface SplitFormatters {
  /** What antfu's `formatters` option receives. */
  antfu: OptionsConfig['formatters']
  /** Whether `.md` and `.mdx` go to `bun fmt`. */
  bun: boolean
}

/** The Bun that runs ESLint, or the one on `PATH`. */
function bunBinary(): string {
  return process.versions.bun ? process.execPath : 'bun'
}

/**
 * Formats `text` as `filename` with `bun fmt`. `bun fmt` reads `bunfig.toml`
 * from `cwd`, not from the file's directory. Throws when Bun cannot format at
 * all, so a missing or outdated Bun fails once instead of on every file.
 */
export function formatWithBun(bin: string, filename: string, text: string, cwd: string): BunFmtResult {
  // The default 1 MiB `maxBuffer` would fail a large Markdown file with ENOBUFS.
  const result = spawnSync(bin, [...BUN_FMT_ARGS, '--stdin-filepath', filename], { cwd, encoding: 'utf8', input: text, maxBuffer: Infinity })
  if (result.error) {
    const code = 'code' in result.error ? result.error.code : undefined
    if (typeof code === 'string' && UNRUNNABLE_BUN_ERRORS.has(code)) {
      throw new Error(`\`formatters.markdown: 'bun'\` needs Bun on PATH, but \`${bin}\` could not be run: ${result.error.message}`)
    }
    return { ok: false, message: result.error.message }
  }
  if (result.status === 0) {
    return { ok: true, code: result.stdout }
  }
  if (result.stderr.includes('Script not found "fmt"')) {
    throw new Error(`\`formatters.markdown: 'bun'\` needs Bun 1.4.4 or later, which ships \`bun fmt\`. Upgrade Bun or pick another formatter.`)
  }
  const fallback = result.signal ? `bun fmt was killed by ${result.signal}` : `bun fmt exited with ${result.status}`
  return { ok: false, message: result.stderr.trim() || fallback }
}

export const bunFmtRule: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Format Markdown and MDX with `bun fmt`',
    },
    fixable: 'whitespace',
    schema: [],
    messages,
  },
  create(context) {
    return {
      [context.sourceCode.ast.type || 'Program']() {
        const source = context.sourceCode.text
        const result = formatWithBun(bunBinary(), context.filename, source, context.cwd)
        if (result.ok) {
          reportDifferences(context, source, result.code)
          return
        }
        context.report({
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
          message: `Failed to format the file with bun fmt: ${result.message}`,
        })
      },
    }
  },
}

/**
 * Splits `markdown: 'bun'` off the formatters antfu handles. Returns `false`
 * for antfu when nothing else is on, because antfu loads
 * `eslint-plugin-format` for any formatters object.
 */
export function splitBunFormatter(formatters: boolean | PleaseaiFormatters | undefined): SplitFormatters {
  if (typeof formatters !== 'object') {
    return { antfu: formatters, bun: false }
  }
  const { markdown, ...rest } = formatters
  if (markdown !== 'bun') {
    return { antfu: { ...rest, markdown }, bun: false }
  }
  const { astro, css, graphql, html, slidev, svg, xml } = rest
  if (slidev) {
    throw new Error('`formatters.slidev` formats Slidev decks with Prettier, so it needs `markdown: \'prettier\'` and cannot be combined with `markdown: \'bun\'`.')
  }
  const othersOn = [astro, css, graphql, html, svg, xml].some(Boolean)
  return { antfu: othersOn ? rest : false, bun: true }
}

/**
 * Lints `.md` (antfu's Markdown language, or plain text when that is off) and
 * `.mdx` (plain text) with `pleaseai/bun-fmt`. Markdown and MDX code blocks
 * inside Markdown are skipped: they are part of the file that contains them.
 */
export function bunFmt(markdownLanguage: boolean): TypedFlatConfigItem[] {
  const markdown: TypedFlatConfigItem = {
    name: 'pleaseai/formatter/bun/markdown',
    files: [GLOB_MARKDOWN],
    ignores: [GLOB_MARKDOWN_IN_MARKDOWN],
    rules: { 'pleaseai/bun-fmt': 'error' },
  }
  if (!markdownLanguage) {
    markdown.languageOptions = { parser: parserPlain }
  }
  return [
    {
      name: 'pleaseai/formatter/bun/setup',
      plugins: { pleaseai: { rules: { 'bun-fmt': bunFmtRule } } },
    },
    markdown,
    {
      name: 'pleaseai/formatter/bun/mdx',
      files: [GLOB_MDX],
      ignores: [GLOB_MDX_IN_MARKDOWN],
      languageOptions: { parser: parserPlain },
      rules: { 'pleaseai/bun-fmt': 'error' },
    },
  ]
}
