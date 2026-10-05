import type { Tool, ToolApplyResult, ToolContext } from './tools.js'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve as joinPath } from 'node:path'
import { confirm, isCancel } from '@clack/prompts'
import {
  isPackageInstalled,
  readFileOrNull,
  readPackageJson,
  upsertMarkerBlock,
  writePackageJson,
} from './fs-utils.js'
import { t } from './i18n.js'

async function confirmOverwrite(file: string, auto: boolean): Promise<boolean> {
  if (auto) {
    return true
  }
  const answer = await confirm({
    message: t('overwritePrompt')(file),
    initialValue: false,
  })
  if (isCancel(answer)) {
    return false
  }
  return answer === true
}

// --- eslint-config ----------------------------------------------------------

const ESLINT_CONFIG_TEMPLATE = `import pleaseai from '@pleaseai/eslint-config'

export default pleaseai()
`

async function applyEslintConfig(ctx: ToolContext): Promise<ToolApplyResult> {
  const result: ToolApplyResult = { created: [], updated: [], skipped: [] }
  const target = joinPath(ctx.cwd, 'eslint.config.mjs')
  const label = 'eslint.config.mjs'

  if (existsSync(target)) {
    const ok = await confirmOverwrite(label, ctx.autoAccept)
    if (!ok) {
      result.skipped.push(label)
      return result
    }
    writeFileSync(target, ESLINT_CONFIG_TEMPLATE)
    result.updated.push(label)
    return result
  }

  writeFileSync(target, ESLINT_CONFIG_TEMPLATE)
  result.created.push(label)
  return result
}

// --- prettier-config --------------------------------------------------------

async function applyPrettierConfig(ctx: ToolContext): Promise<ToolApplyResult> {
  const result: ToolApplyResult = { created: [], updated: [], skipped: [] }
  const pkg = readPackageJson(ctx.cwd)
  const label = 'package.json#prettier'

  if (pkg.prettier === '@pleaseai/prettier-config') {
    // Already configured — nothing to do.
    return result
  }

  if (pkg.prettier != null) {
    const ok = await confirmOverwrite(label, ctx.autoAccept)
    if (!ok) {
      result.skipped.push(label)
      return result
    }
  }

  pkg.prettier = '@pleaseai/prettier-config'
  writePackageJson(pkg, ctx.cwd)
  result.updated.push(label)
  return result
}

// --- editorconfig -----------------------------------------------------------

async function applyEditorConfig(ctx: ToolContext): Promise<ToolApplyResult> {
  const result: ToolApplyResult = { created: [], updated: [], skipped: [] }
  const target = joinPath(ctx.cwd, '.editorconfig')
  const source = joinPath(ctx.cwd, 'node_modules', '@pleaseai', 'editorconfig', '.editorconfig')
  const label = '.editorconfig'

  if (!existsSync(source)) {
    // Package not installed yet (e.g. install step failed). Skip silently.
    result.skipped.push(label)
    return result
  }

  if (existsSync(target)) {
    const ok = await confirmOverwrite(label, ctx.autoAccept)
    if (!ok) {
      result.skipped.push(label)
      return result
    }
    copyFileSync(source, target)
    result.updated.push(label)
    return result
  }

  copyFileSync(source, target)
  result.created.push(label)
  return result
}

// --- AGENTS.md --------------------------------------------------------------

const AGENTS_BODY = `# PleaseAI Code Style

These rules are managed by \`@pleaseai/code-style\`. Run \`pleaseai-code-style update\`
to refresh this block. Do not edit between the marker comments — your changes
will be overwritten.

- Formatter: \`@pleaseai/eslint-config\` (wraps \`@antfu/eslint-config\`)
- No semicolons, single quotes, 2-space indent, trailing commas, LF line endings
- ESM only — never emit \`require\`/\`module.exports\`
- TypeScript: \`strict: true\`, prefer \`type\` over \`interface\`, no implicit \`any\`
- Prefer named exports, early returns, \`async\`/\`await\`, optional chaining
- File size target: ≤ 500 lines
- Tests live under the package's \`test/\` (or \`tests/\`) root, mirroring the source path
  (\`src/foo/bar.ts\` → \`test/foo/bar.test.ts\`); no \`import.meta.vitest\` in-source tests
- Conventional Commits for all commit messages

For the full rules (what an AI coding assistant needs to know before writing code),
read \`node_modules/@pleaseai/code-style/rules.md\`.`

const AGENTS_CODE_ORGANIZATION = `- Code organization (named exports, file names, error files, test paths, shared helpers):
  \`node_modules/@pleaseai/ast-grep-config/README.md\`; check with \`ast-grep scan\` and \`please-style check\`
`

/**
 * The code-organization pointer needs the ast-grep tooling: include it when
 * `ast-grep` is among the selected tools or the project already depends on
 * `@ast-grep/cli`. Without selection info (`selectedToolIds` unset) it is kept.
 */
function wantsCodeOrganization(ctx: ToolContext): boolean {
  if (ctx.selectedToolIds == null || ctx.selectedToolIds.includes('ast-grep')) {
    return true
  }
  try {
    return isPackageInstalled(readPackageJson(ctx.cwd), '@ast-grep/cli')
  }
  catch {
    return false
  }
}

function agentsBody(ctx: ToolContext): string {
  return wantsCodeOrganization(ctx)
    ? AGENTS_BODY.replace('- Conventional', `${AGENTS_CODE_ORGANIZATION}- Conventional`)
    : AGENTS_BODY
}

export async function applyAgentsMd(ctx: ToolContext): Promise<ToolApplyResult> {
  const result: ToolApplyResult = { created: [], updated: [], skipped: [] }
  const target = joinPath(ctx.cwd, 'AGENTS.md')
  const label = 'AGENTS.md'
  const existing = readFileOrNull(target)
  const next = upsertMarkerBlock(existing, agentsBody(ctx))

  if (existing == null) {
    writeFileSync(target, next)
    result.created.push(label)
    return result
  }

  if (existing === next) {
    // No-op — already up to date.
    return result
  }

  writeFileSync(target, next)
  result.updated.push(label)
  return result
}

// --- ast-grep ---------------------------------------------------------------

const AST_GREP_RULES = 'node_modules/@pleaseai/ast-grep-config/rules'

const SGCONFIG_TEMPLATE = `# ast-grep config — managed by @pleaseai/code-style (ast-grep).
# Run \`ast-grep scan\` for the structural rules and \`please-style check\`
# for file-name and test-path rules. Every rule is a warning.
ruleDirs:
  - ${AST_GREP_RULES}
`

function normalizeRuleDir(entry: string): string {
  return entry.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/^\.\//, '').replace(/\/$/, '')
}

/**
 * Whether the parsed `ruleDirs` of an sgconfig.yml lists the shipped rules.
 * Comments are ignored; a block list and a single-line flow list are read.
 * Anything else (multi-line flow list, odd structure) counts as not listed so
 * the caller falls through to the overwrite confirmation.
 */
function listsAstGrepRules(yaml: string): boolean {
  const lines = yaml.split(/\r?\n/).map(l => l.replace(/(^|\s)#.*$/, ''))
  const start = lines.findIndex(l => l.startsWith('ruleDirs:'))
  if (start === -1) {
    return false
  }
  const inline = lines[start]!.slice('ruleDirs:'.length).trim()
  let entries: string[] = []
  if (inline.startsWith('[')) {
    entries = inline.endsWith(']') ? inline.slice(1, -1).split(',') : []
  }
  else if (inline === '') {
    for (const line of lines.slice(start + 1)) {
      const item = /^\s*-\s+(\S.*)$/.exec(line)
      if (item != null) {
        entries.push(item[1]!)
      }
      else if (line.trim() !== '') {
        break
      }
    }
  }
  return entries.some(e => normalizeRuleDir(e) === AST_GREP_RULES)
}

export async function applyAstGrep(ctx: ToolContext): Promise<ToolApplyResult> {
  const result: ToolApplyResult = { created: [], updated: [], skipped: [] }
  const target = joinPath(ctx.cwd, 'sgconfig.yml')
  const label = 'sgconfig.yml'
  const existing = readFileOrNull(target)

  if (existing == null) {
    writeFileSync(target, SGCONFIG_TEMPLATE)
    result.created.push(label)
    return result
  }

  if (listsAstGrepRules(existing)) {
    // Already lists the rules in `ruleDirs` — keep the user's other settings.
    return result
  }

  const ok = await confirmOverwrite(label, ctx.autoAccept)
  if (!ok) {
    result.skipped.push(label)
    return result
  }
  writeFileSync(target, SGCONFIG_TEMPLATE)
  result.updated.push(label)
  return result
}

// --- Registry ---------------------------------------------------------------

export const TOOLS: Tool[] = [
  {
    id: 'eslint-config',
    label: '@pleaseai/eslint-config (eslint.config.mjs)',
    packages: ['@pleaseai/eslint-config', 'eslint'],
    apply: applyEslintConfig,
  },
  {
    id: 'prettier-config',
    label: '@pleaseai/prettier-config (package.json#prettier)',
    packages: ['@pleaseai/prettier-config', 'prettier'],
    apply: applyPrettierConfig,
  },
  {
    id: 'editorconfig',
    label: '@pleaseai/editorconfig (.editorconfig)',
    packages: ['@pleaseai/editorconfig'],
    apply: applyEditorConfig,
  },
  {
    id: 'agents-md',
    label: 'AGENTS.md (AI coding rules block)',
    packages: [],
    apply: applyAgentsMd,
  },
  {
    id: 'ast-grep',
    label: '@pleaseai/ast-grep-config (sgconfig.yml + please-style check)',
    // @ast-grep/cli is a peer of the rules package and an optional peer of
    // this CLI: installing it as a direct dependency links the `ast-grep` bin
    // (pnpm, and npm in some layouts, only link bins of direct dependencies)
    // and lets `please-style check` resolve it from the project.
    packages: ['@pleaseai/ast-grep-config', '@ast-grep/cli'],
    apply: applyAstGrep,
  },
]

export function findTool(id: string): Tool | undefined {
  return TOOLS.find(t => t.id === id)
}
