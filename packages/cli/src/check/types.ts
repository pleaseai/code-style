/** Languages the path checker knows. */
export type Language = 'typescript' | 'dart' | 'kotlin' | 'java' | 'rust'

/** The three ADR-0022 slugs that layer 3 enforces. */
export type Slug
  = | 'code-filename-matches-primary-symbol'
    | 'test-path-derivable-from-source'
    | 'test-helpers-in-dedicated-location'

/** What exactly went wrong, finer than the slug. */
export type FindingKind
  = | 'filename-mismatch'
    | 'orphan-test'
    | 'test-outside-root'
    | 'undiscovered-integration-test'
    | 'unreachable-unit-test'
    | 'shared-helper-outside-location'

export interface Finding {
  slug: Slug
  kind: FindingKind
  /** Always `warning`: ADR-0022 §5 ships every rule as warn. */
  severity: 'warning'
  language: Language
  /** Path relative to the checked root, `/`-separated. */
  file: string
  /** 1-based line, when the finding points at a declaration. */
  line?: number
  message: string
}

export interface CheckResult {
  /** Checked root (absolute). */
  root: string
  findings: Finding[]
  /** Things the checker could not do, e.g. Rust skipped because cargo is missing. */
  notices: string[]
}

/** The subset of `cargo metadata --no-deps --format-version 1` the checker reads. */
export interface CargoMetadata {
  packages: Array<{
    name: string
    manifest_path: string
    targets: Array<{ name: string, kind: string[], src_path: string }>
  }>
}

/**
 * Returns `cargo metadata` for the crate or workspace at `dir`, or `null` when
 * it cannot be obtained. Throwing `CargoUnavailableError` skips Rust entirely.
 */
export type CargoMetadataProvider = (dir: string) => CargoMetadata | null

export interface CheckOptions {
  /** Directory to check. Defaults to `process.cwd()`. */
  root?: string
  /** Explicit config file; defaults to `<root>/code-organization.json` when present. */
  configPath?: string
  /** Injectable `cargo metadata` source (tests, environments without cargo). */
  cargoMetadata?: CargoMetadataProvider
}
