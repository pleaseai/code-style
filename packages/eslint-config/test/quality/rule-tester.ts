import type { ESLint } from 'eslint'
import parser from '@typescript-eslint/parser'
import { describe, it } from 'bun:test'
import { RuleTester as ESLintRuleTester } from 'eslint'
import { pluginQuality } from '../../src/quality'

ESLintRuleTester.describe = describe
ESLintRuleTester.it = it

export class RuleTester extends ESLintRuleTester {
  constructor(_config?: unknown) {
    super({ languageOptions: { parser } })
  }
}

export function rule(name: string): NonNullable<ESLint.Plugin['rules']>[string] {
  const module = pluginQuality.rules?.[name]
  if (!module) {
    throw new Error(`Unknown quality rule: ${name}`)
  }
  return module
}
