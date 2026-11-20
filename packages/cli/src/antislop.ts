import type { PackageJson } from './fs-utils.js'
import { resolve } from 'node:path'
import { TOOLS } from './appliers.js'
import { isPackageInstalled, readFileOrNull } from './fs-utils.js'

const ESLINT_CONFIG_NAMES = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(ext => `eslint.config.${ext}`)
const ANTISLOP_OPT_OUT = /\bantislop\s*:\s*false\b/

export interface AntislopStatus {
  /** `@pleaseai/eslint-config` is installed and the ESLint config leaves at least one antislop plugin on. */
  applies: boolean
  optedOut: boolean
  plugins: Array<{ name: string, installed: boolean }>
  missing: string[]
}

function isPluginOptedOut(config: string, name: string): boolean {
  const option = name.replace(/^eslint-plugin-/, '')
  return new RegExp(`\\b${option}\\s*:\\s*false\\b`).test(config)
}

function readPackageJsonOrNull(cwd: string): PackageJson | null {
  const raw = readFileOrNull(resolve(cwd, 'package.json'))
  if (raw == null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as PackageJson : null
  }
  catch {
    return null
  }
}

export function antislopStatus(cwd: string): AntislopStatus {
  const none: AntislopStatus = { applies: false, optedOut: false, plugins: [], missing: [] }
  const pkg = readPackageJsonOrNull(cwd)
  if (pkg == null || !isPackageInstalled(pkg, '@pleaseai/eslint-config')) {
    return none
  }
  const config = ESLINT_CONFIG_NAMES.map(name => readFileOrNull(resolve(cwd, name)) ?? '').join('\n')
  const names = (TOOLS.find(tool => tool.id === 'eslint-config')?.optionalPackages ?? [])
    .filter(name => !isPluginOptedOut(config, name))
  if (ANTISLOP_OPT_OUT.test(config) || names.length === 0) {
    return { ...none, optedOut: true }
  }
  const plugins = names.map(name => ({ name, installed: isPackageInstalled(pkg, name) }))
  return { applies: true, optedOut: false, plugins, missing: plugins.filter(p => !p.installed).map(p => p.name) }
}
