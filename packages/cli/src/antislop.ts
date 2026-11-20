import type { PackageJson } from './fs-utils.js'
import { resolve } from 'node:path'
import { TOOLS } from './appliers.js'
import { isPackageInstalled, readFileOrNull } from './fs-utils.js'

const ESLINT_CONFIG_NAMES = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(ext => `eslint.config.${ext}`)
const ANTISLOP_OPT_OUT = /\bantislop\s*:\s*false\b/

export interface AntislopStatus {
  /** `@pleaseai/eslint-config` is installed and the ESLint config does not set `antislop: false`. */
  applies: boolean
  optedOut: boolean
  plugins: Array<{ name: string, installed: boolean }>
  missing: string[]
}

function isOptedOut(cwd: string): boolean {
  return ESLINT_CONFIG_NAMES.some(name => ANTISLOP_OPT_OUT.test(readFileOrNull(resolve(cwd, name)) ?? ''))
}

export function antislopStatus(cwd: string): AntislopStatus {
  const none: AntislopStatus = { applies: false, optedOut: false, plugins: [], missing: [] }
  const raw = readFileOrNull(resolve(cwd, 'package.json'))
  if (raw == null) {
    return none
  }
  const pkg = JSON.parse(raw) as PackageJson
  if (!isPackageInstalled(pkg, '@pleaseai/eslint-config')) {
    return none
  }
  if (isOptedOut(cwd)) {
    return { ...none, optedOut: true }
  }
  const names = TOOLS.find(tool => tool.id === 'eslint-config')?.optionalPackages ?? []
  const plugins = names.map(name => ({ name, installed: isPackageInstalled(pkg, name) }))
  return { applies: true, optedOut: false, plugins, missing: plugins.filter(p => !p.installed).map(p => p.name) }
}
