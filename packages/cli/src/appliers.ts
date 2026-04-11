import type { Tool, ToolApplyResult, ToolContext } from './tools.js'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve as joinPath } from 'node:path'
import { confirm, isCancel } from '@clack/prompts'
import {
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
- File size target: ≤ 500 lines; colocate \`*.test.ts\` with the source
- Conventional Commits for all commit messages

For the full rules (what an AI coding assistant needs to know before writing code),
read \`node_modules/@pleaseai/code-style/rules.md\`.`

export async function applyAgentsMd(ctx: ToolContext): Promise<ToolApplyResult> {
  const result: ToolApplyResult = { created: [], updated: [], skipped: [] }
  const target = joinPath(ctx.cwd, 'AGENTS.md')
  const label = 'AGENTS.md'
  const existing = readFileOrNull(target)
  const next = upsertMarkerBlock(existing, AGENTS_BODY)

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
]

export function findTool(id: string): Tool | undefined {
  return TOOLS.find(t => t.id === id)
}
