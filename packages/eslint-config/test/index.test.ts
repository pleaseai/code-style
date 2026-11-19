import type { TypedFlatConfigItem } from '../src/index'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'
import { ESLint } from 'eslint'
import pluginImport from 'eslint-plugin-import'
import { resolveAntislop } from '../src/antislop'
import pleaseai, { parserPlain } from '../src/index'

function pluginNames(configs: TypedFlatConfigItem[]): Set<string> {
  return new Set(configs.flatMap(config => Object.keys(config.plugins ?? {})))
}

function ruleIds(configs: TypedFlatConfigItem[]): string[] {
  return configs.flatMap(config => Object.keys(config.rules ?? {}))
}

/** Resolves the canonical config in a child process where `eslint-plugin-import` cannot be loaded. */
function resolveWithoutEslintPluginImport(...args: string[]) {
  const fixture = fileURLToPath(new URL('./fixtures/without-eslint-plugin-import.ts', import.meta.url))
  return Bun.spawnSync([process.execPath, fixture, ...args], { stdout: 'ignore', stderr: 'pipe' })
}

function ruleEntry(configs: TypedFlatConfigItem[], id: string): unknown {
  return configs.filter(config => config.rules?.[id] !== undefined).at(-1)?.rules?.[id]
}

describe('pleaseai', () => {
  test('keeps antfu\'s plugin names by default', async () => {
    const configs = await pleaseai()

    expect(pluginNames(configs)).toContain('ts')
    expect(pluginNames(configs)).not.toContain('@typescript-eslint')
    expect(configs.find(config => config.name === 'antfu/imports/rules')?.plugins?.import).not.toBe(pluginImport)
  })

  test('merges rules from options with the PleaseAI defaults', async () => {
    const configs = await pleaseai({ rules: { 'no-console': 'error', 'antfu/top-level-function': 'off' } })

    expect(ruleEntry(configs, 'no-console')).toBe('error')
    expect(ruleEntry(configs, 'antfu/top-level-function')).toBe('off')
    expect(ruleEntry(configs, 'test/prefer-lowercase-title')).toBe('off')
  })
})

describe('antislop', () => {
  test('does not lint file types that no config parses', async () => {
    const options = { antislop: true, vue: false, jsonc: false, markdown: false, yaml: false, toml: false }
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai(options) })
    const unparsed = [
      'src/style.css',
      'src/page.html',
      'src/feed.xml',
      'src/App.vue',
      'src/App.svelte',
      'src/schema.graphql',
      'src/data.json',
      'src/notes.md',
      'src/config.yaml',
      'src/config.toml',
    ]

    for (const filePath of unparsed) {
      expect(await eslint.calculateConfigForFile(filePath)).toBeUndefined()
    }

    const [result] = await eslint.lintText('// a — b\nexport const a = 1\n', { filePath: 'src/a.ts' })

    expect(result!.messages.map(message => message.ruleId)).toContain('slop/no-em-dash')
  })

  test('lints a file type only within the scope of the config that parses it', async () => {
    const htmlParser = { files: ['src/**/*.html'], ignores: ['src/legacy/**'], languageOptions: { parser: parserPlain } }
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ antislop: true }, htmlParser) })

    const [result] = await eslint.lintText('<!-- a — b -->\n<p>hi</p>\n', { filePath: 'src/page.html' })

    expect(result!.messages.filter(message => message.fatal)).toEqual([])
    expect(result!.messages.map(message => message.ruleId)).toContain('slop/no-em-dash')
    expect(await eslint.calculateConfigForFile('public/page.html')).toBeUndefined()
    expect(await eslint.calculateConfigForFile('src/legacy/page.html')).toBeUndefined()
    expect(await eslint.calculateConfigForFile('src/style.css')).toBeUndefined()
  })

  test('does not lint other languages for a parser config without files', async () => {
    const globalParser = { languageOptions: { parser: parserPlain } }
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ antislop: true }, globalParser) })

    expect(await eslint.calculateConfigForFile('src/style.css')).toBeUndefined()
  })

  test('reports em dashes in Markdown as warnings', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ antislop: true }) })

    const [markdown] = await eslint.lintText('# Title\n\na — b\n', { filePath: 'docs/notes.md' })
    const [code] = await eslint.lintText('// a — b\nexport const a = 1\n', { filePath: 'src/a.ts' })
    const severityOf = (result: ESLint.LintResult) => result.messages.find(message => message.ruleId === 'slop/no-em-dash')?.severity

    expect(severityOf(markdown!)).toBe(1)
    expect(severityOf(code!)).toBe(2)
  })

  test('keeps Vue files when the Vue config parses them', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ antislop: true, vue: true }) })

    const [result] = await eslint.lintText('<template>\n  <p>a — b</p>\n</template>\n', { filePath: 'src/App.vue' })

    expect(result!.messages.filter(message => message.fatal)).toEqual([])
    expect(result!.messages.map(message => message.ruleId)).toContain('slop/no-em-dash')
  })
})

describe('resolveAntislop', () => {
  const installed = (...names: string[]) => (name: string) => names.includes(name)

  test('is off by default when neither plugin is installed', () => {
    expect(resolveAntislop(undefined, installed())).toBe(false)
  })

  test('turns on by default only the installed plugins', () => {
    expect(resolveAntislop(undefined, installed('eslint-plugin-slop'))).toEqual({ slop: true, sonarjs: false })
    expect(resolveAntislop(undefined, installed('eslint-plugin-slop', 'eslint-plugin-sonarjs'))).toEqual({ slop: true, sonarjs: true })
  })

  test('explains how to install the plugins an explicit option needs', () => {
    expect(() => resolveAntislop(true, installed('eslint-plugin-slop')))
      .toThrow('`antislop` requires `eslint-plugin-sonarjs`. Install with `bun add -D eslint-plugin-sonarjs`')
  })

  test('does not require a plugin the option turns off', () => {
    expect(resolveAntislop({ sonarjs: false }, installed('eslint-plugin-slop'))).toEqual({ sonarjs: false })
    expect(resolveAntislop(false, installed())).toBe(false)
  })
})

describe('canonicalPluginNames', () => {
  test('registers typescript-eslint as @typescript-eslint and keeps the other renames', async () => {
    const configs = await pleaseai({ canonicalPluginNames: true })
    const plugins = pluginNames(configs)

    expect(plugins).toContain('@typescript-eslint')
    expect(plugins).not.toContain('ts')
    expect(plugins).toContain('style')
    expect(plugins).toContain('node')
    expect(ruleIds(configs).filter(id => id.startsWith('ts/'))).toEqual([])
  })

  test('renames ts/* rule settings from options and user configs', async () => {
    const configs = await pleaseai(
      { canonicalPluginNames: true, typescript: { overrides: { 'ts/no-explicit-any': 'warn' } } },
      { rules: { 'ts/array-type': 'error' } },
    )

    expect(ruleEntry(configs, '@typescript-eslint/no-explicit-any')).toBe('warn')
    expect(ruleEntry(configs, '@typescript-eslint/array-type')).toBe('error')
  })

  test('replaces eslint-plugin-import-lite with eslint-plugin-import', async () => {
    const configs = await pleaseai({ canonicalPluginNames: true })

    expect(configs.find(config => config.name === 'antfu/imports/rules')?.plugins?.import).toBe(pluginImport)
    expect(ruleEntry(configs, 'import/consistent-type-specifier-style')).toEqual(['error', 'prefer-top-level'])
  })

  test('passes through type specifier styles that need no translation', async () => {
    const rule = 'import/consistent-type-specifier-style'
    const preferred = await pleaseai({ canonicalPluginNames: true, rules: { [rule]: ['error', 'prefer-top-level'] } })
    // A prototype key must not resolve to an inherited member such as `Object.prototype.toString`.
    const inherited = await pleaseai({ canonicalPluginNames: true, rules: { [rule]: ['error', 'toString' as 'inline'] } })

    expect(ruleEntry(preferred, rule)).toEqual(['error', 'prefer-top-level'])
    expect(ruleEntry(inherited, rule)).toEqual(['error', 'toString'])
  })

  test('registers no import plugin when imports are disabled', async () => {
    const configs = await pleaseai({ canonicalPluginNames: true, imports: false })

    expect(pluginNames(configs)).not.toContain('import')
  })

  test('does not load eslint-plugin-import when imports are disabled', () => {
    const result = resolveWithoutEslintPluginImport('imports=false')

    expect(result.stderr.toString()).toBe('')
    expect(result.exitCode).toBe(0)
  })

  test('explains how to install eslint-plugin-import when it is missing', () => {
    const result = resolveWithoutEslintPluginImport()

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('`canonicalPluginNames` requires `eslint-plugin-import`')
  })

  test('reports under the canonical rule IDs when linting', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: await pleaseai({ canonicalPluginNames: true }),
    })
    const code = [
      'import { type A } from \'./a\'',
      '',
      'const b = 1',
      '',
      'import { c } from \'./c\'',
      '',
      'type D = { d: A }',
      '',
      'export { b, c }',
      'export type { D }',
      '',
    ].join('\n')

    const [result] = await eslint.lintText(code, { filePath: 'src/example.ts' })
    const reported = result!.messages.map(message => message.ruleId)

    expect(result!.messages.filter(message => message.fatal)).toEqual([])
    expect(reported).toContain('@typescript-eslint/consistent-type-definitions')
    expect(reported).toContain('import/consistent-type-specifier-style')
    expect(reported).toContain('import/first')
  })
})
