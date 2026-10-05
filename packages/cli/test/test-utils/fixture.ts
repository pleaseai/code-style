import type { CargoMetadata, CheckOptions, CheckResult, Finding } from '../../src/check/types.js'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { checkCodeOrganization } from '../../src/check/check-code-organization.js'

export interface Fixture {
  root: string
  cleanup: () => void
}

/** Writes `files` (path → contents) into a fresh temp directory. */
export function createFixture(files: Record<string, string>): Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'code-org-test-')))
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

/** Builds a `cargo metadata` stub for one package; `targets` are `[kind, srcPath]` pairs relative to `pkgDir`. */
export function cargoStub(root: string, pkgDir: string, targets: Array<[string, string]>): CargoMetadata {
  const dir = join(root, pkgDir)
  return {
    packages: [{
      name: 'fixture',
      manifest_path: join(dir, 'Cargo.toml'),
      targets: targets.map(([kind, src]) => ({ name: src, kind: [kind], src_path: join(dir, src) })),
    }],
  }
}

/** Runs the checker on a fixture and returns its findings for one slug. */
export function findingsFor(
  files: Record<string, string>,
  slug: Finding['slug'],
  options: Omit<CheckOptions, 'root'> | ((root: string) => Omit<CheckOptions, 'root'>) = {},
): Finding[] {
  return checkFixture(files, options).findings.filter(f => f.slug === slug)
}

/** Runs the checker on a fixture tree (or on its `subdir`) and cleans it up afterwards. */
export function checkFixture(
  files: Record<string, string>,
  options: Omit<CheckOptions, 'root'> | ((root: string) => Omit<CheckOptions, 'root'>) = {},
  subdir = '',
): CheckResult {
  const fixture = createFixture(files)
  try {
    const opts = typeof options === 'function' ? options(fixture.root) : options
    return checkCodeOrganization({ ...opts, root: join(fixture.root, subdir) })
  }
  finally {
    fixture.cleanup()
  }
}
