import type { TypedFlatConfigItem } from '../src/index'
import { describe, expect, test } from 'bun:test'
import { ESLint } from 'eslint'
import pluginImport from 'eslint-plugin-import'
import pleaseai from '../src/index'

function pluginNames(configs: TypedFlatConfigItem[]): Set<string> {
  return new Set(configs.flatMap(config => Object.keys(config.plugins ?? {})))
}

function ruleIds(configs: TypedFlatConfigItem[]): string[] {
  return configs.flatMap(config => Object.keys(config.rules ?? {}))
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

  test('registers no import plugin when imports are disabled', async () => {
    const configs = await pleaseai({ canonicalPluginNames: true, imports: false })

    expect(pluginNames(configs)).not.toContain('import')
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
