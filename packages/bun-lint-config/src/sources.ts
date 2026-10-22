import type { Linter } from 'eslint'
import type { BuiltinRules } from './generate'
import { readFileSync } from 'node:fs'
import { pleaseai } from '@pleaseai/eslint-config'

/**
 * The configs lint.toml is generated from. `canonicalPluginNames` names
 * rules the way Bun runs them natively; `gitignore` and `isInEditor` are off
 * so the output does not depend on the repository or the environment it is
 * generated in.
 */
export async function loadEslintConfigs(): Promise<Linter.Config[]> {
  const composer = pleaseai({ canonicalPluginNames: true, typescript: true, vue: false, gitignore: false, isInEditor: false })
  return await composer.toConfigs() as Linter.Config[]
}

export function loadBuiltinRules(): BuiltinRules {
  return JSON.parse(readFileSync(new URL('../builtin-rules.json', import.meta.url), 'utf-8')) as BuiltinRules
}
