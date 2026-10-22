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
  ],
}

interface Lint {
  ignorePatterns?: string[]
  rules: Record<string, unknown>
  overrides: Array<{ files: string[], excludeFiles?: string[], rules: Record<string, unknown> }>
}

function generate(...configs: Linter.Config[]): Lint {
  return (parse(generateLintToml(configs, builtin)) as unknown as { lint: Lint }).lint
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
    expect(lint.overrides[0]!.rules).toEqual({ eqeqeq: ['error', 'smart'] })
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

describe('lint.toml', () => {
  test('is up to date with @pleaseai/eslint-config and builtin-rules.json (run `bun run generate`)', async () => {
    const committed = readFileSync(new URL('../lint.toml', import.meta.url), 'utf-8')
    expect(committed).toBe(generateLintToml(await loadEslintConfigs(), loadBuiltinRules()))
    expect(committed.startsWith('# Generated from @pleaseai/eslint-config')).toBe(true)
  })
})
