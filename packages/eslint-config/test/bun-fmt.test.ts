import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, describe, expect, test } from 'bun:test'
import { ESLint } from 'eslint'
import { formatWithBun, splitBunFormatter } from '../src/bun-fmt'
import pleaseai from '../src/index'

const UNALIGNED_TABLE = '# Title\n\n|a|b|\n|-|-|\n|1|2|\n'
const ALIGNED_TABLE = '# Title\n\n| a   | b   |\n| --- | --- |\n| 1   | 2   |\n'

const scratch = mkdtempSync(join(tmpdir(), 'bun-fmt-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

async function lintWithBunFmt(code: string, filePath: string, options: { markdown?: boolean } = {}) {
  const eslint = new ESLint({
    cwd: scratch,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: await pleaseai({ antislop: false, formatters: { markdown: 'bun' }, ...options }),
  })
  const [result] = await eslint.lintText(code, { filePath: join(scratch, filePath) })
  return result!
}

function bunFmtMessages(result: ESLint.LintResult) {
  return result.messages.filter(message => message.ruleId === 'pleaseai/bun-fmt')
}

describe('formatters.markdown: bun', () => {
  test('formats Markdown with bun fmt', async () => {
    const result = await lintWithBunFmt(UNALIGNED_TABLE, 'docs/a.md')

    expect(result.output).toBe(ALIGNED_TABLE)
  })

  test('formats MDX with bun fmt', async () => {
    const result = await lintWithBunFmt(`import { X } from './x'\n\n${UNALIGNED_TABLE}`, 'docs/a.mdx')

    expect(result.messages.filter(message => message.fatal)).toEqual([])
    expect(result.output).toBe(`import { X } from './x'\n\n${ALIGNED_TABLE}`)
  })

  test('leaves code blocks to the ESLint rules', async () => {
    const code = '# Title\n\n```md\n|a|b|\n|-|-|\n```\n\n```js\nexport const a = 1\n```\n'
    const result = await lintWithBunFmt(code, 'docs/a.md')

    expect(bunFmtMessages(result)).toEqual([])
    expect(result.output).toBeUndefined()
  })

  test('leaves MDX code blocks inside Markdown to the ESLint rules', async () => {
    const code = '# Title\n\n```mdx\n|a|b|\n|-|-|\n```\n'
    const result = await lintWithBunFmt(code, 'docs/a.md')

    expect(bunFmtMessages(result)).toEqual([])
    expect(result.output).toBeUndefined()
  })

  test('formats Markdown read as plain text when the Markdown config is off', async () => {
    const result = await lintWithBunFmt(UNALIGNED_TABLE, 'docs/a.md', { markdown: false })

    expect(result.messages.filter(message => message.fatal)).toEqual([])
    expect(result.output).toBe(ALIGNED_TABLE)
  })

  test('reads the fmt section of bunfig.toml in the working directory', async () => {
    const project = mkdtempSync(join(scratch, 'project-'))
    writeFileSync(join(project, 'bunfig.toml'), '[fmt]\nignorePatterns = ["**/CHANGELOG.md"]\n')

    const formatted = formatWithBun(process.execPath, join(project, 'docs/a.md'), UNALIGNED_TABLE, project)
    const ignored = formatWithBun(process.execPath, join(project, 'CHANGELOG.md'), UNALIGNED_TABLE, project)

    expect(formatted).toEqual({ ok: true, code: ALIGNED_TABLE })
    expect(ignored).toEqual({ ok: true, code: UNALIGNED_TABLE })
  })

  test('lets the rules option turn pleaseai/bun-fmt off', async () => {
    const configs = await pleaseai({ formatters: { markdown: 'bun' }, rules: { 'pleaseai/bun-fmt': 'off' } })
    const eslint = new ESLint({ cwd: scratch, overrideConfigFile: true, overrideConfig: configs })

    for (const file of ['README.md', 'docs/a.mdx']) {
      const config = await eslint.calculateConfigForFile(join(scratch, file))
      expect(config?.rules?.['pleaseai/bun-fmt']).toEqual([0])
    }
  })

  test('applies a pleaseai/bun-fmt severity to Markdown and MDX only', async () => {
    const configs = await pleaseai({ formatters: { markdown: 'bun' }, rules: { 'pleaseai/bun-fmt': 'warn' } })
    const eslint = new ESLint({ cwd: scratch, overrideConfigFile: true, overrideConfig: configs })

    for (const file of ['README.md', 'docs/a.mdx']) {
      const config = await eslint.calculateConfigForFile(join(scratch, file))
      expect(config?.rules?.['pleaseai/bun-fmt']).toEqual([1])
    }
    for (const file of ['src/index.ts', 'README.md/0.md', 'README.md/0.mdx']) {
      const config = await eslint.calculateConfigForFile(join(scratch, file))
      expect(config?.rules?.['pleaseai/bun-fmt']?.[0] ?? 0).toBe(0)
    }
  })

  test('does not route unrelated rules from the rules option onto Markdown or MDX', async () => {
    const configs = await pleaseai({ formatters: { markdown: 'bun' }, rules: { 'style/semi': ['error', 'never'] } })
    const eslint = new ESLint({ cwd: scratch, overrideConfigFile: true, overrideConfig: configs })

    for (const [file, code] of [['README.md', '# Title\n'], ['docs/a.mdx', '# Title\n']] as const) {
      const [result] = await eslint.lintText(code, { filePath: join(scratch, file) })
      expect(result!.messages.filter(message => message.fatal)).toEqual([])
    }
  })

  test('registers no eslint-plugin-format config when bun is the only formatter', async () => {
    const configs = await pleaseai({ formatters: { markdown: 'bun' } })
    const names = configs.map(config => config.name)

    expect(names).toContain('pleaseai/formatter/bun/markdown')
    expect(names).toContain('pleaseai/formatter/bun/mdx')
    expect(names.filter(name => name?.startsWith('antfu/formatter'))).toEqual([])
  })
})

describe('splitBunFormatter', () => {
  test('passes options without markdown: bun to antfu unchanged', () => {
    expect(splitBunFormatter(true)).toEqual({ antfu: true, bun: false })
    expect(splitBunFormatter(undefined)).toEqual({ antfu: undefined, bun: false })
    expect(splitBunFormatter({ css: true, markdown: 'prettier' })).toEqual({ antfu: { css: true, markdown: 'prettier' }, bun: false })
  })

  test('explains that slidev cannot be combined with bun', () => {
    expect(() => splitBunFormatter({ markdown: 'bun', slidev: true })).toThrow('cannot be combined with `markdown: \'bun\'`')
  })

  test('keeps the other formatters for antfu', () => {
    expect(splitBunFormatter({ markdown: 'bun' })).toEqual({ antfu: false, bun: true })
    expect(splitBunFormatter({ markdown: 'bun', css: true, prettierOptions: { printWidth: 100 } }))
      .toEqual({ antfu: { css: true, prettierOptions: { printWidth: 100 } }, bun: true })
  })
})

describe('formatWithBun', () => {
  test('explains how to get Bun when it cannot be run', () => {
    expect(() => formatWithBun(join(scratch, 'missing-bun'), 'a.md', UNALIGNED_TABLE, scratch))
      .toThrow('needs Bun on PATH')
  })

  test('explains the version needed when Bun has no fmt command', () => {
    const oldBun = join(scratch, 'old-bun')
    writeFileSync(oldBun, '#!/bin/sh\n[ \"$1\" = --version ] && { echo 1.4.4; exit 0; }\necho \'error: Script not found "fmt"\' >&2\nexit 1\n')
    chmodSync(oldBun, 0o755)

    expect(() => formatWithBun(oldBun, 'a.md', UNALIGNED_TABLE, scratch)).toThrow('needs Bun 1.4.4 or later')
  })

  test('rejects an old Bun before running its fmt script', () => {
    const hijackedBun = join(scratch, 'hijacked-bun')
    writeFileSync(hijackedBun, '#!/bin/sh\n[ "$1" = --version ] && { echo 1.3.14; exit 0; }\ncat >/dev/null\necho HIJACKED\n')
    chmodSync(hijackedBun, 0o755)

    expect(() => formatWithBun(hijackedBun, 'a.md', UNALIGNED_TABLE, scratch)).toThrow('needs Bun 1.4.4 or later')
  })

  test('rejects a Bun whose version cannot be determined', () => {
    const mysteryBun = join(scratch, 'mystery-bun')
    writeFileSync(mysteryBun, '#!/bin/sh\necho HIJACKED\n')
    chmodSync(mysteryBun, 0o755)

    expect(() => formatWithBun(mysteryBun, 'a.md', UNALIGNED_TABLE, scratch)).toThrow('needs Bun 1.4.4 or later')
  })

  test('reports why `bun --version` failed', () => {
    const brokenBun = join(scratch, 'broken-bun')
    writeFileSync(brokenBun, '#!/bin/sh\necho \'dyld: missing library\' >&2\nexit 3\n')
    chmodSync(brokenBun, 0o755)

    expect(() => formatWithBun(brokenBun, 'a.md', UNALIGNED_TABLE, scratch)).toThrow('dyld: missing library')
  })

  test('formats output larger than the default spawnSync buffer', () => {
    const large = `# Title\n\n${'A paragraph of text.\n\n'.repeat(60_000).trimEnd()}\n`

    expect(formatWithBun(process.execPath, join(scratch, 'large.md'), large, scratch)).toEqual({ ok: true, code: large })
  })

  test('names the signal that killed bun fmt', () => {
    const killedBun = join(scratch, 'killed-bun')
    writeFileSync(killedBun, '#!/bin/sh\n[ \"$1\" = --version ] && { echo 1.4.4; exit 0; }\nkill -9 $$\n')
    chmodSync(killedBun, 0o755)

    expect(formatWithBun(killedBun, 'a.md', UNALIGNED_TABLE, scratch)).toEqual({ ok: false, message: 'bun fmt was killed by SIGKILL' })
  })

  test('returns other bun fmt failures for the file', () => {
    const failingBun = join(scratch, 'failing-bun')
    writeFileSync(failingBun, '#!/bin/sh\n[ \"$1\" = --version ] && { echo 1.4.4; exit 0; }\necho \'error: Unexpected token\' >&2\nexit 2\n')
    chmodSync(failingBun, 0o755)

    expect(formatWithBun(failingBun, 'a.md', UNALIGNED_TABLE, scratch)).toEqual({ ok: false, message: 'error: Unexpected token' })
  })
})
