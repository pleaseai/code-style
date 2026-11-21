import type { Linter } from 'eslint'
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

function ruleEntry(configs: TypedFlatConfigItem[], id: string): Linter.RuleEntry | undefined {
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

    const [result] = await eslint.lintText('// a \u2014 b\nexport const a = 1\n', { filePath: 'src/a.ts' })

    expect(result!.messages.map(message => message.ruleId)).toContain('slop/no-em-dash')
  })

  test('lints a file type only within the scope of the config that parses it', async () => {
    const htmlParser = { files: ['src/**/*.html'], ignores: ['src/legacy/**'], languageOptions: { parser: parserPlain } }
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ antislop: true }, htmlParser) })

    const [result] = await eslint.lintText('<!-- a \u2014 b -->\n<p>hi</p>\n', { filePath: 'src/page.html' })

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

    const [markdown] = await eslint.lintText('# Title\n\na \u2014 b\n', { filePath: 'docs/notes.md' })
    const [code] = await eslint.lintText('// a \u2014 b\nexport const a = 1\n', { filePath: 'src/a.ts' })
    const severityOf = (result: ESLint.LintResult) => result.messages.find(message => message.ruleId === 'slop/no-em-dash')?.severity

    expect(severityOf(markdown!)).toBe(1)
    expect(severityOf(code!)).toBe(2)
  })

  test('keeps Vue files when the Vue config parses them', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ antislop: true, vue: true }) })

    const [result] = await eslint.lintText('<template>\n  <p>a \u2014 b</p>\n</template>\n', { filePath: 'src/App.vue' })

    expect(result!.messages.filter(message => message.fatal)).toEqual([])
    expect(result!.messages.map(message => message.ruleId)).toContain('slop/no-em-dash')
  })
})

describe('quality', () => {
  const code = 'export function read(owner: object, key: string) {\n  return Reflect.get(owner, key)\n}\n'
  const lint = async (...args: Parameters<typeof pleaseai>) => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai(...args) })
    const [result] = await eslint.lintText(code, { filePath: 'src/read.ts' })
    return result!.messages.map(message => message.ruleId)
  }

  test('is off by default', async () => {
    expect(pluginNames(await pleaseai())).not.toContain('quality')
  })

  test('reports the vendored rules as errors on TypeScript files', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ quality: true }) })
    const [result] = await eslint.lintText(code, { filePath: 'src/read.ts' })
    const quality = result!.messages.filter(message => message.ruleId?.startsWith('quality/'))

    expect(quality.map(message => [message.ruleId, message.severity])).toEqual([
      ['quality/no-object-parameters', 2],
      ['quality/no-reflect-get', 2],
    ])
    expect(quality[0]!.message).toContain('Parameter `owner` uses')
  })

  test('lets options.rules and user configs turn a rule off', async () => {
    const fromOptions = await lint({ quality: true, rules: { 'quality/no-reflect-get': 'off' } })
    const fromUserConfig = await lint({ quality: true }, { rules: { 'quality/no-object-parameters': 'off' } })

    expect(fromOptions).not.toContain('quality/no-reflect-get')
    expect(fromOptions).toContain('quality/no-object-parameters')
    expect(fromUserConfig).not.toContain('quality/no-object-parameters')
    expect(fromUserConfig).toContain('quality/no-reflect-get')
  })

  test('skips code blocks in Markdown', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ quality: true }) })
    const [result] = await eslint.lintText(`# Example\n\n\`\`\`ts\n${code}\`\`\`\n`, { filePath: 'docs/read.md' })

    expect(result!.messages.filter(message => message.fatal)).toEqual([])
    expect(result!.messages.map(message => message.ruleId).filter(id => id?.startsWith('quality/'))).toEqual([])
  })
})

describe('strict', () => {
  const code = [
    'export const a = new Promise(resolve => resolve(1))',
    'export const b = new Promise((resolve) => { return resolve(2) })',
    'const list = [\'x\', \'y\']',
    'export const c = list.includes(\'x\')',
    'export const e = list.includes(\'y\')',
    'export function d(v: string | undefined, w: string | undefined) {',
    '  return v! == w || v == null',
    '}',
    '',
  ].join('\n')
  const strictRules = new Set(['no-promise-executor-return', 'eqeqeq', 'unicorn/prefer-set-has', 'ts/no-confusing-non-null-assertion'])
  const lint = async (options: Parameters<typeof pleaseai>[0], ...userConfigs: TypedFlatConfigItem[]) => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai(options, ...userConfigs) })
    const [result] = await eslint.lintText(code, { filePath: 'src/strict.ts' })
    return result!.messages
  }
  const ids = async (...args: Parameters<typeof lint>) => (await lint(...args)).map(message => message.ruleId)

  test('is off by default', async () => {
    const configs = await pleaseai()

    expect(ruleIds(configs).filter(id => id === 'no-promise-executor-return' || id === 'unicorn/prefer-set-has' || id === 'ts/no-confusing-non-null-assertion')).toEqual([])
    expect(ruleEntry(configs, 'eqeqeq')).toEqual(['error', 'smart'])
    expect(await ids({})).not.toContain('no-promise-executor-return')
  })

  test('reports the rules as errors', async () => {
    const messages = await lint({ strict: true })
    const severities = (id: string) => messages.filter(message => message.ruleId === id).map(message => message.severity)

    for (const id of strictRules) {
      expect(severities(id)).toContain(2)
    }
  })

  test('reports == null, which antfu\'s smart eqeqeq allows', async () => {
    const source = 'export const f = (v?: string) => v == null\n'
    const lintSource = async (options: Parameters<typeof pleaseai>[0]) => {
      const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai(options) })
      const [result] = await eslint.lintText(source, { filePath: 'src/null-check.ts' })
      return result!.messages.map(message => message.ruleId)
    }

    expect(await lintSource({})).not.toContain('eqeqeq')
    expect(await lintSource({ strict: true })).toContain('eqeqeq')
  })

  test('reports the TypeScript rule under the canonical name', async () => {
    const found = await ids({ strict: true, canonicalPluginNames: true })

    expect(found).toContain('@typescript-eslint/no-confusing-non-null-assertion')
    expect(found).not.toContain('ts/no-confusing-non-null-assertion')
  })

  test('lets options.rules and user configs override a rule', async () => {
    const fromOptions = await ids({ strict: true, rules: { 'unicorn/prefer-set-has': 'off' } })
    const fromUserConfig = await ids({ strict: true }, { rules: { eqeqeq: 'off' } })

    expect(fromOptions).not.toContain('unicorn/prefer-set-has')
    for (const id of ['no-promise-executor-return', 'eqeqeq', 'ts/no-confusing-non-null-assertion']) {
      expect(fromOptions).toContain(id)
    }
    expect(fromUserConfig).not.toContain('eqeqeq')
    expect(fromUserConfig).toContain('unicorn/prefer-set-has')
  })

  test('lets antfu\'s plugin override options beat strict', async () => {
    const fromTypescript = await ids({ strict: true, typescript: { overrides: { 'ts/no-confusing-non-null-assertion': 'off' } } })
    const fromCanonical = await ids({ strict: true, canonicalPluginNames: true, typescript: { overrides: { '@typescript-eslint/no-confusing-non-null-assertion': 'off' } } })
    const fromUnicorn = await ids({ strict: true, unicorn: { overrides: { 'unicorn/prefer-set-has': 'off' } } })
    const fromDeprecated = await ids({ strict: true, overrides: { typescript: { 'ts/no-confusing-non-null-assertion': 'off' } } })
    const fromJavascript = await ids({ strict: true, javascript: { overrides: { 'no-promise-executor-return': 'off' } } })

    expect(fromTypescript).not.toContain('ts/no-confusing-non-null-assertion')
    expect(fromTypescript).toContain('eqeqeq')
    expect(fromCanonical).not.toContain('@typescript-eslint/no-confusing-non-null-assertion')
    expect(fromUnicorn).not.toContain('unicorn/prefer-set-has')
    expect(fromUnicorn).toContain('ts/no-confusing-non-null-assertion')
    expect(fromDeprecated).not.toContain('ts/no-confusing-non-null-assertion')
    expect(fromJavascript).not.toContain('no-promise-executor-return')
    expect(fromJavascript).toContain('eqeqeq')
  })

  test('skips a rule whose plugin antfu does not load', async () => {
    const lintJs = async (options: Parameters<typeof pleaseai>[0]) => {
      const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai(options) })
      const [result] = await eslint.lintText(code.replace('v! ==', 'v ==').replaceAll(': string | undefined', ''), { filePath: 'src/strict.js' })
      return result!.messages.map(message => message.ruleId)
    }
    const withoutTs = await lintJs({ strict: true, typescript: false })
    const withoutUnicorn = await ids({ strict: true, unicorn: false })

    expect(withoutTs).not.toContain('ts/no-confusing-non-null-assertion')
    expect(withoutTs).toContain('unicorn/prefer-set-has')
    expect(withoutUnicorn).not.toContain('unicorn/prefer-set-has')
    expect(withoutUnicorn).toContain('eqeqeq')
  })

  test('skips code blocks in Markdown', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ strict: true }) })
    // `== null` is allowed by antfu's `'smart'` eqeqeq, so only strict would report it.
    const [result] = await eslint.lintText(`# Example\n\n\`\`\`ts\n${code.replace('v! == w ||', '')}\`\`\`\n`, { filePath: 'docs/strict.md' })

    expect(result!.messages.filter(message => message.fatal)).toEqual([])
    expect(result!.messages.map(message => message.ruleId).filter(id => id && strictRules.has(id))).toEqual([])
  })
})

describe('strict import/no-self-import', () => {
  const fixture = fileURLToPath(new URL('./fixtures/self-import.mjs', import.meta.url))
  const lint = async (options: Parameters<typeof pleaseai>[0]) => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai(options), cwd: fileURLToPath(new URL('..', import.meta.url)) })
    const [result] = await eslint.lintFiles([fixture])
    return result!.messages.map(message => message.ruleId)
  }

  test('reports a self-import as import/no-self-import', async () => {
    expect(await lint({ strict: true })).toContain('import/no-self-import')
  })

  test('reports it with canonicalPluginNames', async () => {
    expect(await lint({ strict: true, canonicalPluginNames: true })).toContain('import/no-self-import')
  })

  test('reports it as import/no-self-import with autoRenamePlugins off', async () => {
    expect(await lint({ strict: true, autoRenamePlugins: false })).toContain('import/no-self-import')
  })

  test('lints without a missing-plugin error when imports is off', async () => {
    const found = await lint({ strict: true, imports: false })

    expect(found).not.toContain(null)
    expect(found.filter(id => id?.endsWith('no-self-import'))).toEqual([])
  })

  test('keeps import-lite\'s own plugin object without strict', async () => {
    const configs = await pleaseai()
    const plugin = configs.find(config => config.plugins?.import)?.plugins?.import

    expect(plugin?.rules?.['no-self-import']).toBeUndefined()
    expect(ruleIds(await pleaseai())).not.toContain('import/no-self-import')
  })

  test('keeps one import plugin object when a user config registers the same plugin', async () => {
    const original = (await pleaseai()).find(config => config.plugins?.import)!.plugins!.import!
    const configs = await pleaseai({ strict: true }, { plugins: { import: original } })
    const plugins = new Set(configs.map(config => config.plugins?.import).filter(Boolean))

    expect(plugins.size).toBe(1)
    expect([...plugins][0]!.rules?.['no-self-import']).toBeDefined()
  })

  test('registers one import plugin object under strict', async () => {
    const configs = await pleaseai({ strict: true })
    const plugins = new Set(configs.map(config => config.plugins?.import).filter(Boolean))

    expect(plugins.size).toBe(1)
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
    expect(resolveAntislop({ sonarjs: false }, installed('eslint-plugin-slop'))).toEqual({ slop: true, sonarjs: false })
    expect(resolveAntislop(false, installed())).toBe(false)
  })

  test('leaves a plugin the option does not mention to what is installed', () => {
    expect(resolveAntislop({ cognitiveComplexity: 20 }, installed('eslint-plugin-sonarjs')))
      .toEqual({ cognitiveComplexity: 20, slop: false, sonarjs: true })
    expect(resolveAntislop({ sonarjs: false }, installed())).toBe(false)
  })

  test('requires sonarjs when the option sets one of its settings', () => {
    expect(() => resolveAntislop({ cognitiveComplexity: 20 }, installed('eslint-plugin-slop')))
      .toThrow('`antislop` requires `eslint-plugin-sonarjs`.')
    expect(resolveAntislop({ cognitiveComplexity: false }, installed('eslint-plugin-slop')))
      .toEqual({ cognitiveComplexity: false, slop: true, sonarjs: false })
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
