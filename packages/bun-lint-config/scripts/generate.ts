/** Regenerates lint.toml from @pleaseai/eslint-config and builtin-rules.json (`bun run generate`). */
import { writeFileSync } from 'node:fs'
import { generateLintToml } from '../src/generate'
import { loadBuiltinRules, loadEslintConfigs } from '../src/sources'

writeFileSync(new URL('../lint.toml', import.meta.url), generateLintToml(await loadEslintConfigs(), loadBuiltinRules()))
