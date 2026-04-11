/**
 * Registry of tools this CLI knows how to install + configure.
 *
 * Each tool declares:
 * - `id`:       unique key used by prompts and doctor output
 * - `label`:    human-readable name shown in the checkbox UI
 * - `packages`: npm packages installed when this tool is selected
 * - `apply`:    side-effect applied after packages are installed
 *               (returns a list of file labels that were created/updated)
 */
export interface ToolContext {
  cwd: string
  /** If true, skip interactive confirmations (CI / --yes mode). */
  autoAccept: boolean
}

export interface ToolApplyResult {
  /** Files created (absolute labels like `eslint.config.mjs`). */
  created: string[]
  /** Files updated in place. */
  updated: string[]
  /** Files skipped because the user declined overwrite. */
  skipped: string[]
}

export interface Tool {
  id: ToolId
  label: string
  packages: string[]
  apply: (ctx: ToolContext) => Promise<ToolApplyResult>
}

export type ToolId
  = | 'eslint-config'
    | 'prettier-config'
    | 'editorconfig'
    | 'agents-md'

export const EMPTY_RESULT: ToolApplyResult = {
  created: [],
  updated: [],
  skipped: [],
}
