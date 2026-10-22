/**
 * Refreshes builtin-rules.json from a Bun binary that has `bun lint`
 * (`BUN_LINT_BIN=/path/to/bun bun run update-rules`). The pinned Bun has no
 * linter yet, so the snapshot is committed and only refreshed by hand.
 */
import type { BuiltinRule, BuiltinRules } from '../src/generate'
import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { compareIds } from '../src/generate'

interface ListedRule {
  id: string
  aliases: string[]
  modes: string[]
  on_by_default: string | false
}

const bin = process.env.BUN_LINT_BIN ?? 'bun'

function run(args: string[]): string {
  const result = Bun.spawnSync([bin, ...args], { stdout: 'pipe', stderr: 'inherit' })
  if (result.exitCode !== 0) {
    throw new Error(`\`${bin} ${args.join(' ')}\` exited with ${result.exitCode}`)
  }
  return result.stdout.toString().trim()
}

const listed = JSON.parse(run(['lint', '--no-script', '--rules', '-f', 'json'])) as ListedRule[]
const rules: BuiltinRule[] = listed
  .filter(rule => rule.modes.includes('native'))
  .map(rule => ({ id: rule.id, aliases: [...rule.aliases].sort(), on_by_default: rule.on_by_default !== false }))
  .sort((a, b) => compareIds(a.id, b.id))
const snapshot: BuiltinRules = { revision: run(['--revision']), rules }

// One rule per line keeps the snapshot small and its diffs readable.
const lines = rules.map(({ id, aliases, on_by_default }) =>
  `    { "id": ${JSON.stringify(id)}, "aliases": [${aliases.map(alias => JSON.stringify(alias)).join(', ')}], "on_by_default": ${on_by_default} }`)
writeFileSync(
  new URL('../builtin-rules.json', import.meta.url),
  `{\n  "revision": ${JSON.stringify(snapshot.revision)},\n  "rules": [\n${lines.join(',\n')}\n  ]\n}\n`,
)
console.log(`builtin-rules.json: ${rules.length} native rules from bun ${snapshot.revision}`)
