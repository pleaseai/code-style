import type { Linter } from 'eslint'
import type { BuiltinRules } from '../src/generate'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { parse } from 'smol-toml'
import { generateLintToml, isLintedGlob, toBunGlob } from '../src/generate'
import { loadBuiltinRules, loadEslintConfigs } from '../src/sources'

const builtin: BuiltinRules = {
  revision: 'test',
  rules: [
    { id: 'eqeqeq', aliases: ['eslint/eqeqeq'], on_by_default: false },
    { id: 'no-console', aliases: ['eslint/no-console'], on_by_default: false },
    { id: 'no-debugger', aliases: ['eslint/no-debugger'], on_by_default: true },
    { id: 'n/no-path-concat', aliases: ['node/no-path-concat'], on_by_default: false },
    { id: '@typescript-eslint/no-unused-vars', aliases: [], on_by_default: false },
    { id: 'vitest/no-focused-tests', aliases: [], on_by_default: false },
  ],
}

const ruleMap = {
  'unused-imports/no-unused-vars': '@typescript-eslint/no-unused-vars',
  'test/no-only-tests': 'vitest/no-focused-tests',
  'style/semi': 'no-semi-native',
}

interface Lint {
  ignorePatterns?: string[]
  rules: Record<string, unknown>
  overrides: Array<{ files: string[], excludeFiles?: string[], rules: Record<string, unknown> }>
}

function generate(...configs: Linter.Config[]): Lint {
  return (parse(generateLintToml(configs, builtin, ruleMap)) as unknown as { lint: Lint }).lint
}

describe('globs', () => {
  test('converts ?(…) extglobs to brace alternatives', () => {
    expect(toBunGlob('**/*.?([cm])[jt]s?(x)')).toBe('**/*.{,[cm]}[jt]s{,x}')
    expect(toBunGlob('**/*.y?(a|aa)ml')).toBe('**/*.y{,a,aa}ml')
  })

  test('throws on extglobs Bun.Glob cannot express', () => {
    expect(() => toBunGlob('**/*.+(ts|js)')).toThrow('**/*.+(ts|js)')
    expect(() => toBunGlob('**/!(x).ts')).toThrow('!(x)')
    expect(() => toBunGlob('**/?(a|?(b)).ts')).toThrow('Cannot convert')
  })

  test('keeps only globs that can match a JS or TS file', () => {
    expect(isLintedGlob('**/*.{,[cm]}[jt]s{,x}')).toBe(true)
    expect(isLintedGlob('**/bin/**/*')).toBe(true)
    expect(isLintedGlob('**/*.json')).toBe(false)
    expect(isLintedGlob('**/[jt]sconfig.json')).toBe(false)
    expect(isLintedGlob('**/*.md/**/*.ts')).toBe(false)
  })

  test('skips items that only match other files and keeps the linted globs of the rest', () => {
    const lint = generate(
      { files: ['**/*.json'], rules: { eqeqeq: 'error' } },
      { files: ['**/*.md/**/*.ts', '**/*.?([cm])ts'], ignores: ['**/*.d.ts'], rules: { eqeqeq: 'error' } },
    )
    expect(lint.overrides).toEqual([{ files: ['**/*.{,[cm]}ts'], excludeFiles: ['**/*.d.ts'], rules: { eqeqeq: 'error' } }])
  })

  test('expands braces in ignorePatterns, which use .gitignore syntax', () => {
    const lint = generate({ ignores: ['**/auto-import?(s).d.ts', '**/dist', '**/{dist,out}'] })
    expect(lint.ignorePatterns).toEqual(['**/auto-import.d.ts', '**/auto-imports.d.ts', '**/dist', '**/out'])
  })
})

describe('rules', () => {
  test('drops rules that Bun does not run natively and accepts aliases', () => {
    const lint = generate({ rules: { 'eqeqeq': 2, 'style/semi': 'error', 'node/no-path-concat': 1 } })
    expect(lint.rules).toEqual({ 'eqeqeq': 'error', 'node/no-path-concat': 'warn' })
  })

  test('a later global entry removes the rule from earlier overrides', () => {
    const lint = generate(
      { files: ['**/*.ts'], rules: { 'eqeqeq': 'warn', 'no-console': 'error' } },
      { rules: { eqeqeq: 'error' } },
    )
    expect(lint.rules).toEqual({ eqeqeq: 'error' })
    expect(lint.overrides).toEqual([{ files: ['**/*.ts'], rules: { 'no-console': 'error' } }])

    expect(generate({ files: ['**/*.ts'], rules: { eqeqeq: 'warn' } }, { rules: { eqeqeq: 'error' } }).overrides).toEqual([])
  })

  test('a severity-only entry keeps the options of the previous one', () => {
    const lint = generate(
      { rules: { eqeqeq: ['error', 'smart'] } },
      { rules: { eqeqeq: 'warn' } },
      { files: ['**/*.ts'], rules: { eqeqeq: ['error'] } },
    )
    expect(lint.rules).toEqual({ eqeqeq: ['warn', 'smart'] })
    expect(lint.overrides[0]!.rules).toEqual({ eqeqeq: 'error' })
  })

  test('a severity-only override is left for bun lint to resolve per file', () => {
    const lint = generate(
      { rules: { eqeqeq: ['error', 'always'] } },
      { files: ['**/*.ts'], rules: { eqeqeq: ['error', 'smart'] } },
      { files: ['**/*'], rules: { eqeqeq: 'warn' } },
    )
    expect(lint.overrides).toEqual([
      { files: ['**/*.ts'], rules: { eqeqeq: ['error', 'smart'] } },
      { files: ['**/*'], rules: { eqeqeq: 'warn' } },
    ])
  })

  test('a later severity-only global entry keeps the options of earlier overrides', () => {
    const lint = generate(
      { files: ['**/*.ts'], rules: { eqeqeq: ['error', 'smart'] } },
      { files: ['**/*.js'], rules: { eqeqeq: ['error', 'smart'] } },
      { rules: { eqeqeq: 'warn' } },
      { rules: { eqeqeq: ['error', 'always'] } },
      { files: ['**/*.mts'], rules: { eqeqeq: ['error', 'smart'] } },
      { rules: { eqeqeq: 'warn' } },
    )
    expect(lint.rules).toEqual({ eqeqeq: ['warn', 'always'] })
    expect(lint.overrides).toEqual([{ files: ['**/*.mts'], rules: { eqeqeq: ['warn', 'smart'] } }])
  })

  test('keeps the options of an `off` entry that a later severity-only override inherits', () => {
    expect(generate(
      { rules: { eqeqeq: ['off', 'smart'] } },
      { files: ['**/*.ts'], rules: { eqeqeq: 'error' } },
    ).rules).toEqual({ eqeqeq: ['off', 'smart'] })
    expect(generate(
      { rules: { 'eqeqeq': ['off', 'smart'], 'no-debugger': ['off', 'x'] } },
    ).rules).toEqual({ 'no-debugger': 'off' })
  })

  test('writes `off` only where it turns a rule off', () => {
    const lint = generate(
      { rules: { 'eqeqeq': 'off', 'no-debugger': 'off' } },
      { files: ['**/*.js'], rules: { 'no-console': 'off' } },
      { files: ['**/*.ts'], rules: { 'no-console': ['error', { allow: ['warn'] }] } },
      { files: ['**/scripts/**'], rules: { 'no-console': 'off' } },
    )
    expect(lint.rules).toEqual({ 'no-debugger': 'off' })
    expect(lint.overrides).toEqual([
      { files: ['**/*.ts'], rules: { 'no-console': ['error', { allow: ['warn'] }] } },
      { files: ['**/scripts/**'], rules: { 'no-console': 'off' } },
    ])
  })

  test('a files-less item with linted ignores becomes an override on every file', () => {
    expect(generate({ ignores: ['**/*.md'], rules: { eqeqeq: 'error' } }).rules).toEqual({ eqeqeq: 'error' })
    expect(generate({ ignores: ['**/*.ts'], rules: { eqeqeq: 'error' } }).overrides)
      .toEqual([{ files: ['**/*'], excludeFiles: ['**/*.ts'], rules: { eqeqeq: 'error' } }])
  })

  test('throws on options TOML cannot represent and drops undefined keys', () => {
    expect(() => generate({ rules: { eqeqeq: ['error', null] } })).toThrow('"eqeqeq"')
    expect(() => generate({ rules: { eqeqeq: ['error', { pattern: /x/ }] } })).toThrow('"eqeqeq"')
    expect(generate({ rules: { eqeqeq: ['error', { null: 'ignore', extra: undefined }] } }).rules)
      .toEqual({ eqeqeq: ['error', { null: 'ignore' }] })
  })
})

describe('rule map', () => {
  test('writes a mapped source as its target, with options and overrides', () => {
    const lint = generate(
      { rules: { 'unused-imports/no-unused-vars': ['error', { args: 'after-used' }] } },
      { files: ['**/*.d.ts'], rules: { 'unused-imports/no-unused-vars': 'off' } },
      { files: ['**/*.test.ts'], rules: { 'test/no-only-tests': 'warn' } },
    )
    expect(lint.rules).toEqual({ '@typescript-eslint/no-unused-vars': ['error', { args: 'after-used' }] })
    expect(lint.overrides).toEqual([
      { files: ['**/*.d.ts'], rules: { '@typescript-eslint/no-unused-vars': 'off' } },
      { files: ['**/*.test.ts'], rules: { 'vitest/no-focused-tests': 'warn' } },
    ])
  })

  test('drops the own `off` entries of the target and throws when one is on', () => {
    const lint = generate(
      { rules: { 'unused-imports/no-unused-vars': 'error' } },
      { files: ['**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': 'off' } },
      { rules: { 'vitest/no-focused-tests': ['off', { x: 1 }] } },
    )
    expect(lint.rules).toEqual({ '@typescript-eslint/no-unused-vars': 'error' })
    expect(lint.overrides).toEqual([])

    expect(() => generate({ files: ['**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': 'warn' } }))
      .toThrow('"@typescript-eslint/no-unused-vars" is on, but "unused-imports/no-unused-vars"')
    expect(() => generate({ rules: { 'vitest/no-focused-tests': ['error'] } })).toThrow('"test/no-only-tests"')
  })

  test('an override that sets one of a core and `@typescript-eslint` pair keeps the other while it is on', () => {
    const pairs: BuiltinRules = {
      revision: 'test',
      rules: ['no-shadow', 'no-redeclare'].flatMap(id => [
        { id, aliases: [], on_by_default: false },
        { id: `@typescript-eslint/${id}`, aliases: [], on_by_default: false },
      ]),
    }
    const lint = (parse(generateLintToml([
      { rules: { 'no-shadow': 'error', 'no-redeclare': 'error' } },
      { files: ['**/*.ts'], rules: { 'no-shadow': 'off', '@typescript-eslint/no-shadow': ['error', { hoist: 'all' }], 'no-redeclare': 'off' } },
      { files: ['**/*.test.ts'], rules: { 'no-shadow': 'off', '@typescript-eslint/no-redeclare': 'error' } },
    ], pairs, {})) as unknown as { lint: Lint }).lint
    expect(lint.overrides).toEqual([
      { files: ['**/*.ts'], rules: { 'no-shadow': 'off', '@typescript-eslint/no-shadow': ['error', { hoist: 'all' }], 'no-redeclare': 'off' } },
      { files: ['**/*.test.ts'], rules: { 'no-shadow': 'off', '@typescript-eslint/no-shadow': ['error', { hoist: 'all' }], '@typescript-eslint/no-redeclare': 'error' } },
    ])
  })

  test('a mapped `@typescript-eslint` target also owns its core rule, which Bun runs as the same rule', () => {
    const lint = generateLintToml([
      { rules: { 'no-unused-vars': ['error', { args: 'none' }], 'unused-imports/no-unused-vars': 'error' } },
      { files: ['**/*.ts'], rules: { 'no-unused-vars': 'off' } },
    ], { revision: 'test', rules: [...builtin.rules, { id: 'no-unused-vars', aliases: [], on_by_default: true }] }, ruleMap)
    expect((parse(lint) as unknown as { lint: Lint }).lint).toEqual({
      rules: { '@typescript-eslint/no-unused-vars': 'error' },
      overrides: [],
    })
  })

  test('ignores a mapping whose target is not native or whose source is', () => {
    const lint = generate({ rules: { 'style/semi': 'error', 'eqeqeq': 'error' } })
    expect(lint.rules).toEqual({ eqeqeq: 'error' })

    const configs = [{ rules: { 'eqeqeq': 'error', 'no-console': 'warn' } }] as Linter.Config[]
    expect(generateLintToml(configs, builtin, { eqeqeq: 'no-console' })).toBe(generateLintToml(configs, builtin, {}))
  })

  test('throws when two sources map to the same target', () => {
    expect(() => generateLintToml([], builtin, { 'a/x': 'eqeqeq', 'b/x': 'eqeqeq' })).toThrow('"a/x" and "b/x"')
  })
})

describe('lint.toml', () => {
  test('is up to date with @pleaseai/eslint-config and builtin-rules.json (run `bun run generate`)', async () => {
    const committed = readFileSync(new URL('../lint.toml', import.meta.url), 'utf-8')
    expect(committed).toBe(generateLintToml(await loadEslintConfigs(), loadBuiltinRules()))
    expect(committed.startsWith('# Generated from @pleaseai/eslint-config')).toBe(true)
  })
})
