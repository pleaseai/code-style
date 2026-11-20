import type { PackageJson, PackageManager } from './fs-utils.js'
import type { Language } from './languages.js'
import type { Tool, ToolApplyResult, ToolContext } from './tools.js'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { cancel, confirm, intro, isCancel, log, multiselect, outro, spinner } from '@clack/prompts'
import { antislopStatus } from './antislop.js'
import { applyAgentsMd, TOOLS } from './appliers.js'
import {
  detectPackageManager,
  installCommand,
  isPackageInstalled,
  readFileOrNull,
  readPackageJson,
} from './fs-utils.js'
import { assertGuidesWritable } from './guides.js'
import { t } from './i18n.js'
import { detectLanguages, guidePathsFromAgentsBlock, LANGUAGES } from './languages.js'

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

function toolOptions(available: Tool[], pkg: PackageJson | undefined): Array<{ value: string, label: string }> {
  return available.map((tool) => {
    const installed = pkg != null
      && tool.packages.length > 0
      && tool.packages.some(p => isPackageInstalled(pkg, p))
    return {
      value: tool.id,
      label: installed ? `${tool.label} ${t('alreadyInstalled')}` : tool.label,
    }
  })
}

async function chooseLanguages(opts: CommandOptions): Promise<Language[]> {
  const detected = detectLanguages(opts.cwd)
  if (opts.autoAccept) {
    return detected
  }
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
  return chosen
}

function installPackages(pm: PackageManager, packages: string[], cwd: string): void {
  if (packages.length === 0) {
    return
  }
  const [cmd, args] = installCommand(pm, packages)
  const spin = spinner()
  spin.start(t('installing'))
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
  })
  if (res.status !== 0) {
    spin.stop(t('installFailed'))
    process.exit(1)
  }
  spin.stop(t('installDone'))
}

function installToolPackages(pm: PackageManager, tools: Tool[], cwd: string): void {
  installPackages(pm, Array.from(
    new Set(tools.flatMap(tool => [...tool.packages, ...(tool.optionalPackages ?? [])])),
  ), cwd)
}

function formatInstallCommand(pm: PackageManager, packages: string[]): string {
  const [cmd, args] = installCommand(pm, packages)
  return [cmd, ...args].join(' ')
}

async function offerAntislopInstall(opts: CommandOptions): Promise<void> {
  const { applies, missing } = antislopStatus(opts.cwd)
  if (!applies || missing.length === 0) {
    return
  }
  const pm = detectPackageManager(opts.cwd)
  const command = formatInstallCommand(pm, missing)
  let install = opts.autoAccept
  if (!install && process.stdin.isTTY) {
    const answer = await confirm({
      message: t('antislopConfirm')(missing.join(', '), command),
      initialValue: true,
    })
    install = !isCancel(answer) && answer
  }
  if (!install) {
    log.info(t('antislopNotInstalled')(command))
    return
  }
  installPackages(pm, missing, opts.cwd)
  log.info(t('antislopNextSteps'))
}

export async function runInit(opts: CommandOptions): Promise<void> {
  intro(t('appTitle'))

  const withPackages = hasPackageJson(opts.cwd)
  const pm = withPackages ? detectPackageManager(opts.cwd) : undefined
  const pkg = withPackages ? readPackageJson(opts.cwd) : undefined
  if (pm != null) {
    log.info(t('detectedPm')(pm))
  }

  const available = withPackages ? TOOLS : TOOLS.filter(tool => tool.packages.length === 0)
  const options = toolOptions(available, pkg)

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

  const withGuides = selectedTools.some(tool => tool.id === 'agents-md')
  const languages = opts.languages === undefined && withGuides ? await chooseLanguages(opts) : opts.languages
  if (withGuides) {
    // Fail before installing anything rather than leave a half-configured project.
    assertGuidesWritable(opts.cwd, languages ?? [])
  }

  // 1. Install packages (de-duped) for selected tools.
  if (pm != null) {
    installToolPackages(pm, selectedTools, opts.cwd)
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

export async function runUpdate(opts: CommandOptions): Promise<void> {
  intro(t('appTitle'))
  const result = await applyAgentsMd({ cwd: opts.cwd, autoAccept: true, selectedToolIds: [], languages: opts.languages })
  reportResults(result)
  log.success(t('agentsBlockUpdated'))
  await offerAntislopInstall(opts)
  outro(t('done'))
}

function logPresence(cwd: string, path: string): void {
  const exists = existsSync(resolve(cwd, path))
  log.info(`  ${path}: ${exists ? t('doctorOk') : t('doctorMissing')}`)
}

function logPackageTools(cwd: string): void {
  const pkg = readPackageJson(cwd)
  log.info(`  ${t('detectedPm')(detectPackageManager(cwd))}`)

  for (const tool of TOOLS) {
    if (tool.packages.length === 0) {
      continue
    }
    const installed = tool.packages.every(p => isPackageInstalled(pkg, p))
    const suffix = installed ? t('doctorOk') : t('doctorMissing')
    log.info(`  ${tool.label}: ${suffix}`)
  }
}

function logAntislop(cwd: string): void {
  const { optedOut, plugins, missing } = antislopStatus(cwd)
  if (optedOut) {
    log.info(`  ${t('doctorAntislopOff')}`)
    return
  }
  for (const { name, installed } of plugins) {
    log.info(`  ${installed ? `${name} (antislop): ${t('doctorOk')}` : t('doctorAntislopMissing')(name)}`)
  }
  if (missing.length > 0) {
    log.info(`  ${t('doctorAntislopInstall')(formatInstallCommand(detectPackageManager(cwd), missing))}`)
  }
}

function logLanguages(opts: CommandOptions): void {
  if (opts.languages != null) {
    log.info(`  ${t('doctorSelectedLanguages')(opts.languages.join(', '))}`)
    return
  }
  const languages = detectLanguages(opts.cwd)
  log.info(`  ${languages.length > 0 ? t('doctorLanguages')(languages.join(', ')) : t('doctorNoLanguages')}`)
}

export function runDoctor(opts: CommandOptions): void {
  log.info(`${t('doctorHeading')}:`)

  const packageBased = hasPackageJson(opts.cwd)
  if (packageBased) {
    logPackageTools(opts.cwd)
    logAntislop(opts.cwd)
  }

  logLanguages(opts)

  // File presence checks. Without a package.json, init offers only the AGENTS.md block.
  const files = packageBased
    ? ['eslint.config.mjs', '.editorconfig', 'AGENTS.md', 'sgconfig.yml']
    : ['AGENTS.md']
  for (const f of files) {
    logPresence(opts.cwd, f)
  }

  for (const guide of guidePathsFromAgentsBlock(readFileOrNull(resolve(opts.cwd, 'AGENTS.md'))) ?? []) {
    logPresence(opts.cwd, guide)
  }
}
