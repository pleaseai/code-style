import type { PleaseaiOptions, TypedFlatConfigItem } from '../src/index.js'
import { describe, expect, test } from 'bun:test'
import { pleaseai } from '../src/index.js'

const userConfig: TypedFlatConfigItem = {
  files: ['**/*.ts'],
  rules: {
    'ts/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
    'node/no-sync': 'error',
  },
}

async function resolve(options: PleaseaiOptions) {
  const configs = await pleaseai(options, userConfig)
  return {
    plugins: new Set(configs.flatMap(c => Object.keys(c.plugins ?? {}))),
    rules: Object.assign({}, ...configs.map(c => c.rules ?? {})) as Record<string, unknown>,
  }
}

describe('canonicalPluginNames', () => {
  test('keeps antfu plugin names by default', async () => {
    const { plugins, rules } = await resolve({})
    expect(plugins).toContain('ts')
    expect(plugins).toContain('node')
    expect(plugins).not.toContain('@typescript-eslint')
    expect(plugins).not.toContain('n')
    expect(rules['ts/no-unused-vars']).toBe('warn')
  })

  test('registers @typescript-eslint and n under canonical names', async () => {
    const { plugins, rules } = await resolve({ canonicalPluginNames: true })
    expect(plugins).toContain('@typescript-eslint')
    expect(plugins).toContain('n')
    expect(plugins).not.toContain('ts')
    expect(plugins).not.toContain('node')
    expect(Object.keys(rules).filter(r => r.startsWith('ts/') || r.startsWith('node/'))).toEqual([])
    expect(rules['@typescript-eslint/no-explicit-any']).toBe('error')
    expect(rules['@typescript-eslint/no-unused-vars']).toBe('warn')
    expect(rules['n/no-sync']).toBe('error')
  })

  test('keeps the other antfu renames', async () => {
    const { plugins } = await resolve({ canonicalPluginNames: true })
    expect(plugins).toContain('style')
    expect(plugins).toContain('import')
    expect(plugins).not.toContain('@stylistic')
  })
})
