import type { Tool, ToolApplyResult, ToolContext } from './tools.js'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { cancel, intro, isCancel, log, multiselect, outro, spinner } from '@clack/prompts'
import { applyAgentsMd, TOOLS } from './appliers.js'
import {
  detectPackageManager,
  installCommand,
  isPackageInstalled,
  readPackageJson,
} from './fs-utils.js'
import { t } from './i18n.js'

export interface CommandOptions {
  cwd: string
  autoAccept: boolean
}

function assertProjectRoot(cwd: string): void {
  if (!existsSync(resolve(cwd, 'package.json'))) {
    log.error(t('noPackageJson'))
    process.exit(1)
  }
}

function mergeResults(results: ToolApplyResult[]): ToolApplyResult {
  const merged: ToolApplyResult = { created: [], updated: [], skipped: [] }
  for (const r of results) {
    merged.created.push(...r.created)
    merged.updated.push(...r.updated)
    merged.skipped.push(...r.skipped)
  }
  return merged
}

function reportResults(result: ToolApplyResult): void {
  for (const f of result.created) {
    log.success(t('created')(f))
  }
  for (const f of result.updated) {
    log.success(t('updated')(f))
  }
  for (const f of result.skipped) {
    log.warn(t('skipped')(f))
  }
}

// --- init -------------------------------------------------------------------

export async function runInit(opts: CommandOptions): Promise<void> {
  assertProjectRoot(opts.cwd)
  intro(t('appTitle'))

  const pm = detectPackageManager(opts.cwd)
  log.info(t('detectedPm')(pm))

  const pkg = readPackageJson(opts.cwd)

  const options = TOOLS.map((tool) => {
    const installed = tool.packages.length > 0
      && tool.packages.some(p => isPackageInstalled(pkg, p))
    return {
      value: tool.id,
      label: installed ? `${tool.label} ${t('alreadyInstalled')}` : tool.label,
    }
  })

  const initialValues = opts.autoAccept ? TOOLS.map(tool => tool.id) : undefined

  const selectedIdsRaw = opts.autoAccept
    ? TOOLS.map(tool => tool.id)
    : await multiselect({
        message: t('selectTools'),
        options,
        initialValues,
        required: false,
      })

  if (isCancel(selectedIdsRaw)) {
    cancel(t('cancelled'))
    process.exit(0)
  }

  const selectedIds = selectedIdsRaw as string[]
  if (selectedIds.length === 0) {
    log.warn(t('nothingSelected'))
    outro(t('done'))
    return
  }

  const selectedTools: Tool[] = selectedIds
    .map(id => TOOLS.find(tool => tool.id === id))
    .filter((tool): tool is Tool => tool != null)

  // 1. Install packages (de-duped) for selected tools.
  const packagesToInstall = Array.from(
    new Set(selectedTools.flatMap(tool => tool.packages)),
  )

  if (packagesToInstall.length > 0) {
    const [cmd, args] = installCommand(pm, packagesToInstall)
    const spin = spinner()
    spin.start(t('installing'))
    const res = spawnSync(cmd, args, {
      cwd: opts.cwd,
      stdio: 'inherit',
    })
    if (res.status !== 0) {
      spin.stop(t('installFailed'))
      process.exit(1)
    }
    spin.stop(t('installDone'))
  }

  // 2. Apply each tool's side-effects.
  const ctx: ToolContext = { cwd: opts.cwd, autoAccept: opts.autoAccept }
  const results: ToolApplyResult[] = []
  for (const tool of selectedTools) {
    results.push(await tool.apply(ctx))
  }

  reportResults(mergeResults(results))
  outro(t('done'))
}

// --- update -----------------------------------------------------------------

export async function runUpdate(opts: CommandOptions): Promise<void> {
  assertProjectRoot(opts.cwd)
  intro(t('appTitle'))
  const result = await applyAgentsMd({ cwd: opts.cwd, autoAccept: true })
  reportResults(result)
  log.success(t('agentsBlockUpdated'))
  outro(t('done'))
}

// --- doctor -----------------------------------------------------------------

export function runDoctor(opts: CommandOptions): void {
  assertProjectRoot(opts.cwd)
  const pkg = readPackageJson(opts.cwd)
  const pm = detectPackageManager(opts.cwd)

  log.info(`${t('doctorHeading')}:`)
  log.info(`  ${t('detectedPm')(pm)}`)

  // Package-based tools only — file-only tools (agents-md) are reported below.
  for (const tool of TOOLS) {
    if (tool.packages.length === 0) {
      continue
    }
    const installed = tool.packages.every(p => isPackageInstalled(pkg, p))
    const suffix = installed ? t('doctorOk') : t('doctorMissing')
    log.info(`  ${tool.label} — ${suffix}`)
  }

  // File presence checks.
  const files = [
    'eslint.config.mjs',
    '.editorconfig',
    'AGENTS.md',
  ]
  for (const f of files) {
    const exists = existsSync(resolve(opts.cwd, f))
    log.info(`  ${f} — ${exists ? t('doctorOk') : t('doctorMissing')}`)
  }
}
