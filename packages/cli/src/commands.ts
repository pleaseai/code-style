import type { Language } from './languages.js'
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
  readFileOrNull,
  readPackageJson,
} from './fs-utils.js'
import { guidePath } from './guides.js'
import { t } from './i18n.js'
import { detectLanguages, LANGUAGES, languagesFromAgentsBlock } from './languages.js'

export interface CommandOptions {
  cwd: string
  autoAccept: boolean
  languages?: Language[]
}

function hasPackageJson(cwd: string): boolean {
  return existsSync(resolve(cwd, 'package.json'))
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
  intro(t('appTitle'))

  const withPackages = hasPackageJson(opts.cwd)
  const pm = withPackages ? detectPackageManager(opts.cwd) : undefined
  const pkg = withPackages ? readPackageJson(opts.cwd) : undefined
  if (pm != null) {
    log.info(t('detectedPm')(pm))
  }

  const available = withPackages ? TOOLS : TOOLS.filter(tool => tool.packages.length === 0)
  const options = available.map((tool) => {
    const installed = pkg != null
      && tool.packages.length > 0
      && tool.packages.some(p => isPackageInstalled(pkg, p))
    return {
      value: tool.id,
      label: installed ? `${tool.label} ${t('alreadyInstalled')}` : tool.label,
    }
  })

  const initialValues = opts.autoAccept ? available.map(tool => tool.id) : undefined

  const selectedIdsRaw = opts.autoAccept
    ? available.map(tool => tool.id)
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
    .map(id => available.find(tool => tool.id === id))
    .filter((tool): tool is Tool => tool != null)

  let languages = opts.languages
  if (languages === undefined && selectedTools.some(tool => tool.id === 'agents-md')) {
    const detected = detectLanguages(opts.cwd)
    if (opts.autoAccept) {
      languages = detected
    }
    else {
      const chosen = await multiselect({
        message: t('selectLanguages'),
        options: LANGUAGES.map(value => ({ value, label: value })),
        initialValues: detected,
        required: false,
      })
      if (isCancel(chosen)) {
        cancel(t('cancelled'))
        process.exit(0)
      }
      languages = chosen
    }
  }

  // 1. Install packages (de-duped) for selected tools.
  const packagesToInstall = Array.from(
    new Set(selectedTools.flatMap(tool => tool.packages)),
  )

  if (pm != null && packagesToInstall.length > 0) {
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
  const ctx: ToolContext = { cwd: opts.cwd, autoAccept: opts.autoAccept, selectedToolIds: selectedTools.map(tool => tool.id), languages }
  const results: ToolApplyResult[] = []
  for (const tool of selectedTools) {
    results.push(await tool.apply(ctx))
  }

  reportResults(mergeResults(results))
  outro(t('done'))
}

// --- update -----------------------------------------------------------------

export async function runUpdate(opts: CommandOptions): Promise<void> {
  intro(t('appTitle'))
  const result = await applyAgentsMd({ cwd: opts.cwd, autoAccept: true, selectedToolIds: [], languages: opts.languages })
  reportResults(result)
  log.success(t('agentsBlockUpdated'))
  outro(t('done'))
}

// --- doctor -----------------------------------------------------------------

export function runDoctor(opts: CommandOptions): void {
  log.info(`${t('doctorHeading')}:`)

  if (hasPackageJson(opts.cwd)) {
    const pkg = readPackageJson(opts.cwd)
    log.info(`  ${t('detectedPm')(detectPackageManager(opts.cwd))}`)

    for (const tool of TOOLS) {
      if (tool.packages.length === 0) {
        continue
      }
      const installed = tool.packages.every(p => isPackageInstalled(pkg, p))
      const suffix = installed ? t('doctorOk') : t('doctorMissing')
      log.info(`  ${tool.label} — ${suffix}`)
    }
  }

  if (opts.languages != null) {
    log.info(`  ${t('doctorSelectedLanguages')(opts.languages.join(', '))}`)
  }
  else {
    const languages = detectLanguages(opts.cwd)
    log.info(`  ${languages.length > 0 ? t('doctorLanguages')(languages.join(', ')) : t('doctorNoLanguages')}`)
  }

  // File presence checks.
  const files = [
    'eslint.config.mjs',
    '.editorconfig',
    'AGENTS.md',
    'sgconfig.yml',
  ]
  for (const f of files) {
    const exists = existsSync(resolve(opts.cwd, f))
    log.info(`  ${f} — ${exists ? t('doctorOk') : t('doctorMissing')}`)
  }

  const linked = languagesFromAgentsBlock(readFileOrNull(resolve(opts.cwd, 'AGENTS.md')))
  for (const id of linked == null ? [] : ['general', ...linked]) {
    const guide = guidePath(id)
    const exists = existsSync(resolve(opts.cwd, guide))
    log.info(`  ${guide} — ${exists ? t('doctorOk') : t('doctorMissing')}`)
  }
}
