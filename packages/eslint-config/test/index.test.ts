import type { Linter } from 'eslint'
import type { PleaseaiOptions, TypedFlatConfigItem } from '../src/index'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'bun:test'
import { ESLint } from 'eslint'
import pluginImport from 'eslint-plugin-import'
import { resolveAntislop } from '../src/antislop'
import pleaseai, { parserPlain } from '../src/index'
import { RESOLVER_NAME } from '../src/strict'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

interface LintTarget {
  /** Lints this source as `filePath`; without it, lints the file at `filePath`. */
  code?: string
  filePath: string
  cwd?: string
  /** Extra configs, appended when `configsOrOptions` is an options object. */
  userConfigs?: TypedFlatConfigItem[]
}

/** Lints one source or file with `pleaseai(options, ...userConfigs)`, or with configs that are already resolved. */
async function lintMessages(configsOrOptions: PleaseaiOptions | TypedFlatConfigItem[], { code, filePath, cwd, userConfigs = [] }: LintTarget): Promise<Linter.LintMessage[]> {
  const overrideConfig = Array.isArray(configsOrOptions) ? configsOrOptions : await pleaseai(configsOrOptions, ...userConfigs)
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig, cwd })
  const [result] = code === undefined ? await eslint.lintFiles([filePath]) : await eslint.lintText(code, { filePath })
  return result!.messages
}

async function lintRuleIds(...args: Parameters<typeof lintMessages>): Promise<(string | null)[]> {
  return (await lintMessages(...args)).map(message => message.ruleId)
}

/** A file in `test/fixtures`, linted from the package root. */
function fixtureFile(name: string): LintTarget {
  return { filePath: fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), cwd: PACKAGE_ROOT }
}

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
  const ids = (options: PleaseaiOptions, ...userConfigs: TypedFlatConfigItem[]) => lintRuleIds(options, { code, filePath: 'src/strict.ts', userConfigs })

  test('is off by default', async () => {
    const configs = await pleaseai()

    // eqeqeq is configured by antfu already, as `'smart'`; strict only tightens it.
    expect(ruleIds(configs).filter(id => strictRules.has(id) && id !== 'eqeqeq')).toEqual([])
    expect(ruleEntry(configs, 'eqeqeq')).toEqual(['error', 'smart'])
    expect(await ids({})).not.toContain('no-promise-executor-return')
  })

  test('reports the rules as errors', async () => {
    const messages = await lintMessages({ strict: true }, { code, filePath: 'src/strict.ts' })
    const severities = (id: string) => messages.filter(message => message.ruleId === id).map(message => message.severity)

    for (const id of strictRules) {
      expect(severities(id)).toContain(2)
    }
  })

  test('reports == null, which antfu\'s smart eqeqeq allows', async () => {
    const source = { code: 'export const f = (v?: string) => v == null\n', filePath: 'src/null-check.ts' }
    const [lenient, strictFound] = await Promise.all([lintRuleIds({}, source), lintRuleIds({ strict: true }, source)])

    expect(lenient).not.toContain('eqeqeq')
    expect(strictFound).toContain('eqeqeq')
  })

  test('reports the TypeScript rule under the canonical name', async () => {
    const found = await ids({ strict: true, canonicalPluginNames: true })

    expect(found).toContain('@typescript-eslint/no-confusing-non-null-assertion')
    expect(found).not.toContain('ts/no-confusing-non-null-assertion')
  })

  test('lets options.rules and user configs override a rule', async () => {
    const [fromOptions, fromUserConfig] = await Promise.all([
      ids({ strict: true, rules: { 'unicorn/prefer-set-has': 'off' } }),
      ids({ strict: true }, { rules: { eqeqeq: 'off' } }),
    ])

    expect(fromOptions).not.toContain('unicorn/prefer-set-has')
    for (const id of ['no-promise-executor-return', 'eqeqeq', 'ts/no-confusing-non-null-assertion']) {
      expect(fromOptions).toContain(id)
    }
    expect(fromUserConfig).not.toContain('eqeqeq')
    expect(fromUserConfig).toContain('unicorn/prefer-set-has')
  })

  test('lets antfu\'s plugin override options beat strict', async () => {
    const [fromTypescript, fromCanonical, fromUnicorn, fromDeprecated, fromJavascript] = await Promise.all([
      ids({ strict: true, typescript: { overrides: { 'ts/no-confusing-non-null-assertion': 'off' } } }),
      ids({ strict: true, canonicalPluginNames: true, typescript: { overrides: { '@typescript-eslint/no-confusing-non-null-assertion': 'off' } } }),
      ids({ strict: true, unicorn: { overrides: { 'unicorn/prefer-set-has': 'off' } } }),
      ids({ strict: true, overrides: { typescript: { 'ts/no-confusing-non-null-assertion': 'off' } } }),
      ids({ strict: true, javascript: { overrides: { 'no-promise-executor-return': 'off' } } }),
    ])

    expect(fromTypescript).not.toContain('ts/no-confusing-non-null-assertion')
    expect(fromTypescript).toContain('eqeqeq')
    expect(fromCanonical).not.toContain('@typescript-eslint/no-confusing-non-null-assertion')
    expect(fromUnicorn).not.toContain('unicorn/prefer-set-has')
    expect(fromUnicorn).toContain('ts/no-confusing-non-null-assertion')
    expect(fromDeprecated).not.toContain('ts/no-confusing-non-null-assertion')
    expect(fromJavascript).not.toContain('no-promise-executor-return')
    expect(fromJavascript).toContain('eqeqeq')
  })

  test('keeps strict outside the files a scoped plugin override applies to', async () => {
    const source = 'export const a = new Promise(resolve => resolve(1))\n'
    const typescript = { strict: true, typescript: { overrides: { 'no-promise-executor-return': 'off' as const } } }
    const testGroup = { strict: true, test: { overrides: { 'no-promise-executor-return': 'off' as const } } }
    const [tsOnTs, tsOnJs, testOnTest, testOnTs] = await Promise.all([
      lintRuleIds(typescript, { code: source, filePath: 'src/a.ts' }),
      lintRuleIds(typescript, { code: source, filePath: 'src/a.js' }),
      lintRuleIds(testGroup, { code: source, filePath: 'src/a.test.ts' }),
      lintRuleIds(testGroup, { code: source, filePath: 'src/a.ts' }),
    ])

    expect(tsOnTs).not.toContain('no-promise-executor-return')
    expect(tsOnJs).toContain('no-promise-executor-return')
    expect(testOnTest).not.toContain('no-promise-executor-return')
    expect(testOnTs).toContain('no-promise-executor-return')
  })

  test('does not leak a scoped override onto configs of another option group', async () => {
    const configs = await pleaseai({ strict: true, typescript: { overrides: { eqeqeq: ['error', 'smart'] } } })
    const [fromJs, fromTs] = await Promise.all([
      lintRuleIds(configs, { code: 'export const a = x => x == null\n', filePath: 'src/a.js' }),
      lintRuleIds(configs, { code: 'export const a = (x: unknown) => x == null\n', filePath: 'src/a.ts' }),
    ])

    expect(fromJs).toContain('eqeqeq')
    expect(fromTs).not.toContain('eqeqeq')
  })

  test('lets every antfu option group\'s overrides beat strict', async () => {
    const eqeqeqFor = async (options: PleaseaiOptions) => {
      const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ strict: true, ...options }) })
      const config = await eslint.calculateConfigForFile('src/a.js')
      return (config?.rules?.eqeqeq as unknown[] | undefined)?.[0]
    }
    const off = { overrides: { eqeqeq: 'off' as const } }

    for (const options of [{ e18e: off }, { regexp: off }, { stylistic: off }]) {
      expect(await eqeqeqFor(options)).toBe(0)
    }
  })

  test('ignores overrides of a plugin group antfu does not load', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: await pleaseai({ strict: true, unicorn: false, overrides: { unicorn: { eqeqeq: 'off' } } } as PleaseaiOptions) })
    const config = await eslint.calculateConfigForFile('src/a.js')

    expect(config?.rules?.eqeqeq).toEqual([2, 'always'])
  })

  test('skips a rule whose plugin antfu does not load', async () => {
    const jsCode = code.replace('v! ==', 'v ==').replaceAll(': string | undefined', '')
    const [withoutTs, withoutUnicorn] = await Promise.all([
      lintRuleIds({ strict: true, typescript: false }, { code: jsCode, filePath: 'src/strict.js' }),
      ids({ strict: true, unicorn: false }),
    ])

    expect(withoutTs).not.toContain('ts/no-confusing-non-null-assertion')
    expect(withoutTs).toContain('unicorn/prefer-set-has')
    expect(withoutUnicorn).not.toContain('unicorn/prefer-set-has')
    expect(withoutUnicorn).toContain('eqeqeq')
  })

  test('skips code blocks in Markdown', async () => {
    // `== null` is allowed by antfu's `'smart'` eqeqeq, so only strict would report it.
    const markdown = `# Example\n\n\`\`\`ts\n${code.replace('v! == w ||', '')}\`\`\`\n`
    const messages = await lintMessages({ strict: true }, { code: markdown, filePath: 'docs/strict.md' })

    expect(messages.filter(message => message.fatal)).toEqual([])
    expect(messages.map(message => message.ruleId).filter(id => id && strictRules.has(id))).toEqual([])
  })
})

describe('strict import/no-self-import', () => {
  const selfImport = fixtureFile('self-import.mjs')

  test('reports a self-import as import/no-self-import', async () => {
    expect(await lintRuleIds({ strict: true }, selfImport)).toContain('import/no-self-import')
  })

  describe('in a TypeScript file', () => {
    describe.each([
      ['default plugins', false],
      ['canonicalPluginNames', true],
    ])('with %s', (_mode, canonicalPluginNames) => {
      test.each([
        ['extensionless', 'self-import-extensionless.ts'],
        ['.js specifier', 'self-import-js.ts'],
      ])('reports a %s self-import', async (_label, name) => {
        expect(await lintRuleIds({ strict: true, canonicalPluginNames }, fixtureFile(name))).toContain('import/no-self-import')
      })

      test('does not report a non-self import', async () => {
        expect(await lintRuleIds({ strict: true, canonicalPluginNames }, fixtureFile('non-self-import.ts'))).not.toContain('import/no-self-import')
      })

      describe('through a tsconfig paths alias', () => {
        let ruleIdsByFile: Record<string, (string | null)[]>

        // One child process per mode: it lints both files in the fixture project.
        beforeAll(async () => {
          const cwd = fileURLToPath(new URL('./fixtures/self-import-alias', import.meta.url))
          const runner = fileURLToPath(new URL('./fixtures/lint-alias.ts', import.meta.url))
          const files = ['alias-self.ts', 'alias-non-self.ts'].map(name => `${cwd}/src/${name}`)
          const proc = Bun.spawn([process.execPath, runner, canonicalPluginNames ? 'canonical' : 'default', ...files], { cwd, stdout: 'pipe', stderr: 'pipe' })
          const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
          expect(stderr).toBe('')
          ruleIdsByFile = JSON.parse(stdout)
        }, 30_000)

        test('reports a self-import', () => {
          expect(ruleIdsByFile['alias-self.ts']).toContain('import/no-self-import')
        })

        test('does not report a non-self import', () => {
          expect(ruleIdsByFile['alias-non-self.ts']).not.toContain('import/no-self-import')
        })
      })
    })
  })

  describe('with a consumer import resolver', () => {
    const resolverConfigs = (configs: Linter.Config[]) => configs.filter(config => config.name === RESOLVER_NAME)
    const canonical = { strict: true, canonicalPluginNames: true }

    test.each<[string, PleaseaiOptions, TypedFlatConfigItem, number]>([
      ['default: a consumer legacy resolver setting removes the strict resolver', { strict: true }, { settings: { 'import-x/resolver': { node: true } } }, 0],
      ['canonical: a consumer resolver with its own ignores removes the strict resolver', canonical, { files: ['**/*.ts'], ignores: ['**/fixtures/**'], settings: { 'import/resolver': { node: { extensions: ['.js'] } } } }, 0],
      ['canonical: a files-less consumer resolver with its own ignores removes the strict resolver', canonical, { ignores: ['**/fixtures/**'], settings: { 'import/resolver': { node: { extensions: ['.js'] } } } }, 0],
      ['default: a consumer import-x/resolve setting removes the strict resolver', { strict: true }, { settings: { 'import-x/resolve': { extensions: ['.mjs'] } } }, 0],
      ['canonical: an import-x resolver setting is not read by eslint-plugin-import, so the strict resolver stays', canonical, { settings: { 'import-x/resolver': { node: true } } }, 1],
      ['canonical: a consumer resolver with negated files removes the strict resolver', canonical, { files: ['!**/fixtures/**'], settings: { 'import/resolver': { node: {} } } }, 0],
    ])('%s', async (_label, options, user, expected) => {
      expect(resolverConfigs(await pleaseai(options, user))).toHaveLength(expected)
    })

    test('canonical: a consumer resolver for every file replaces the strict one', async () => {
      const configs = await pleaseai(canonical, { settings: { 'import/resolver': { node: { extensions: ['.js'] } } } })

      expect(resolverConfigs(configs)).toEqual([])
      expect(await lintRuleIds(configs, fixtureFile('self-import-js.ts'))).not.toContain('import/no-self-import')
    })

    test('a file-scoped consumer resolver removes the strict resolver for every file', async () => {
      const configs = await pleaseai(canonical, { files: ['**/other/**'], settings: { 'import/resolver': { node: {} } } })

      expect(resolverConfigs(configs)).toEqual([])
      expect(await lintRuleIds(configs, fixtureFile('self-import-js.ts'))).not.toContain('import/no-self-import')
    })

    test('default: a consumer import/resolver setting is not read by import-x, so the strict resolver stays', async () => {
      const configs = await pleaseai({ strict: true }, { settings: { 'import/resolver': { typescript: {} } } })

      expect(resolverConfigs(configs)).toHaveLength(1)
      expect(await lintRuleIds(configs, fixtureFile('self-import-js.ts'))).toContain('import/no-self-import')
    })
  })

  test('reports it with canonicalPluginNames', async () => {
    expect(await lintRuleIds({ strict: true, canonicalPluginNames: true }, selfImport)).toContain('import/no-self-import')
  })

  test('reports it as import/no-self-import with autoRenamePlugins off', async () => {
    expect(await lintRuleIds({ strict: true, autoRenamePlugins: false }, selfImport)).toContain('import/no-self-import')
  })

  test('lints without a missing-plugin error when imports is off', async () => {
    const found = await lintRuleIds({ strict: true, imports: false }, selfImport)

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
  }, 30_000)

  test('explains how to install eslint-plugin-import when it is missing', () => {
    const result = resolveWithoutEslintPluginImport()

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('`canonicalPluginNames` requires `eslint-plugin-import`')
  }, 30_000)

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
