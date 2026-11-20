import type { OptionsConfig, OptionsFormatters, TypedFlatConfigItem } from '@antfu/eslint-config'
import type { Linter, Rule } from 'eslint'
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

/** How long one Bun call may run before it is killed, so a stalled Bun cannot hang ESLint. */
const BUN_TIMEOUT_MS = 30_000

/**
 * A plain-parsed file reaches antfu's files-less JavaScript configs, but its
 * AST is empty, so only these rules, which read the raw text, ever report.
 * `bun fmt` owns that whitespace, and `style/no-trailing-spaces` would delete
 * Markdown hard breaks. Antfu's Markdown language runs none of them either.
 */
const PLAIN_TEXT_RULES_OFF: TypedFlatConfigItem['rules'] = {
  'no-irregular-whitespace': 'off',
  'style/eol-last': 'off',
  'style/no-multiple-empty-lines': 'off',
  'style/no-tabs': 'off',
  'style/no-trailing-spaces': 'off',
  'unicode-bom': 'off',
}

export interface PleaseaiFormatters extends Omit<OptionsFormatters, 'markdown'> {
  /**
   * Enable formatting support for Markdown.
   *
   * `'bun'` formats `.md` and `.mdx` with `bun fmt`, which needs a stable
   * Bun 1.4.4 or later on `PATH`. `'prettier'`, `'dprint'` and `true` go to antfu.
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

const MIN_BUN_VERSION = [1, 4, 4]
const OUTDATED_BUN_MESSAGE = '`formatters.markdown: \'bun\'` needs Bun 1.4.4 or later, a stable release that ships `bun fmt`. Canary and debug builds are not supported. Upgrade Bun or pick another formatter.'

/** Binaries already confirmed to be new enough, so `--revision` runs once per binary. */
const checkedBunBinaries = new Set<string>()

/**
 * Accepts the `bun --revision` output of a stable release, `1.4.4+<sha>` (or
 * a bare `1.4.4`, or any SemVer build metadata after the `+`). Canary and
 * debug builds print a pre-release tag before the `+`
 * (`1.4.4-canary.12+<sha>`) and are rejected whatever their version.
 */
function isSupportedBunVersion(revision: string): boolean {
  const parts = /^(\d+)\.(\d+)\.(\d+)(?:\+[\da-z.-]+)?$/i.exec(revision.trim())?.slice(1).map(Number)
  if (!parts) {
    return false
  }
  for (const [index, min] of MIN_BUN_VERSION.entries()) {
    if (parts[index] !== min) {
      return parts[index] > min
    }
  }
  return true
}

/** Throws when a `spawn` error means the Bun binary itself cannot be started. */
function throwIfBunUnrunnable(bin: string, error: Error): void {
  const code = 'code' in error ? error.code : undefined
  if (typeof code === 'string' && UNRUNNABLE_BUN_ERRORS.has(code)) {
    throw new Error(`\`formatters.markdown: 'bun'\` needs Bun on PATH, but \`${bin}\` could not be run: ${error.message}`)
  }
}

/**
 * Throws when a `spawn` error means `bin` ran past `timeout`. A stalled Bun
 * would stall every later file the same way, so the run stops here.
 */
function throwIfBunTimedOut(bin: string, args: string, error: Error, timeout: number): void {
  if ('code' in error && error.code === 'ETIMEDOUT') {
    throw new Error(`\`formatters.markdown: 'bun'\` stopped \`${bin} ${args}\` after ${timeout} ms without a result.`)
  }
}

/**
 * Runs `bin --revision`; throws with the real cause when that cannot be done.
 * `--version` and `process.versions.bun` leave out the canary tag, so they
 * cannot tell a canary build from a release.
 */
function readBunRevision(bin: string, timeout: number): string {
  const result = spawnSync(bin, ['--revision'], { encoding: 'utf8', timeout })
  if (result.error) {
    throwIfBunUnrunnable(bin, result.error)
    throwIfBunTimedOut(bin, '--revision', result.error, timeout)
    throw new Error(`\`formatters.markdown: 'bun'\` could not determine the version of \`${bin}\`: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || (result.signal ? `killed by ${result.signal}` : `exited with ${result.status}`)
    throw new Error(`\`formatters.markdown: 'bun'\` could not determine the version of \`${bin}\`: ${detail}`)
  }
  return result.stdout
}

/**
 * Bun before 1.4.4 ignores `--no-script` and runs the project's `fmt` script,
 * whose output would be applied as the fix, so the version is checked first.
 */
function assertBunSupportsFmt(bin: string, timeout: number): void {
  if (checkedBunBinaries.has(bin)) {
    return
  }
  if (!isSupportedBunVersion(readBunRevision(bin, timeout))) {
    throw new Error(OUTDATED_BUN_MESSAGE)
  }
  checkedBunBinaries.add(bin)
}

/**
 * Formats `text` as `filename` with `bun fmt`. `bun fmt` reads `bunfig.toml`
 * from `cwd`, not from the file's directory. Throws when Bun cannot format at
 * all, so a missing or outdated Bun fails once instead of on every file.
 * A call that runs longer than `timeout` ms is killed, and the run stops.
 */
export function formatWithBun(bin: string, filename: string, text: string, cwd: string, timeout = BUN_TIMEOUT_MS): BunFmtResult {
  assertBunSupportsFmt(bin, timeout)
  // The default 1 MiB `maxBuffer` would fail a large Markdown file with ENOBUFS.
  const result = spawnSync(bin, [...BUN_FMT_ARGS, '--stdin-filepath', filename], { cwd, encoding: 'utf8', input: text, maxBuffer: Infinity, timeout })
  if (result.error) {
    throwIfBunUnrunnable(bin, result.error)
    throwIfBunTimedOut(bin, 'fmt', result.error, timeout)
    return { ok: false, message: result.error.message }
  }
  if (result.status === 0) {
    return { ok: true, code: result.stdout }
  }
  if (result.stderr.includes('Script not found "fmt"')) {
    throw new Error(OUTDATED_BUN_MESSAGE)
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
  // `typeof null` is 'object', and a JavaScript config can pass `null`.
  if (!formatters || typeof formatters !== 'object') {
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
export function bunFmt(markdownLanguage: boolean, severity: Linter.RuleEntry = 'error'): TypedFlatConfigItem[] {
  const markdown: TypedFlatConfigItem = {
    name: 'pleaseai/formatter/bun/markdown',
    files: [GLOB_MARKDOWN],
    ignores: [GLOB_MARKDOWN_IN_MARKDOWN],
    rules: { 'pleaseai/bun-fmt': severity },
  }
  if (!markdownLanguage) {
    markdown.languageOptions = { parser: parserPlain }
    markdown.rules = { ...PLAIN_TEXT_RULES_OFF, ...markdown.rules }
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
      rules: { ...PLAIN_TEXT_RULES_OFF, 'pleaseai/bun-fmt': severity },
    },
  ]
}
