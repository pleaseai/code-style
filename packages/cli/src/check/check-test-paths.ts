import type { CodeOrganizationConfig } from './config.js'
import type { TestLayout, Unit } from './layouts.js'
import type { Finding } from './types.js'
import { DEFAULT_ENV_SEGMENTS, E2E_SEGMENTS } from './config.js'
import { isUnder, joinPath, relativeTo, unitOf } from './layouts.js'

const SLUG = 'test-path-derivable-from-source'

/** Maximum example paths listed in one notice. */
const NOTICE_EXAMPLES = 3

export const LANGUAGE_LABEL: Record<TestLayout['language'], string> = { typescript: 'TypeScript', dart: 'Dart', kotlin: 'Kotlin', java: 'Java' }

/** What marks a unit (package or module) of each layout, for the "outside any package" notice. */
export const UNIT_MARKER: Record<TestLayout['language'], string> = {
  typescript: 'no package.json above them',
  dart: 'no pubspec.yaml above them',
  kotlin: 'not under a Gradle src/<set>/kotlin source set',
  java: 'not under a Gradle src/<set>/java source set',
}

/** `a, b, c, …`: up to three sorted example paths for an aggregated notice. */
export function exampleList(paths: Iterable<string>): string {
  const sorted = [...paths].sort()
  return `${sorted.slice(0, NOTICE_EXAMPLES).join(', ')}${sorted.length > NOTICE_EXAMPLES ? ', …' : ''}`
}

/** Source paths a test under `inner` (path below the test root) may target. */
function candidateSources(inner: string, unit: Unit, layout: TestLayout, withAlternates = true): string[] {
  const segments = inner.split('/')
  const stem = layout.sourceStem(segments.at(-1) ?? '')
  const mirror = [...segments.slice(0, -1), stem]
  const envSegments = new Set([...DEFAULT_ENV_SEGMENTS, ...unit.envSegments])
  // Dual interpretation (ADR-0022 §3): a first segment on the closed env list
  // is tried both as an environment segment and as part of the mirrored path.
  const readings = [mirror]
  if (mirror.length > 1 && envSegments.has(mirror[0] ?? '')) {
    readings.push(mirror.slice(1))
  }
  const bases: string[] = []
  for (const reading of readings) {
    const rel = reading.join('/')
    if (unit.keepRootName) {
      // Several roots: the root name is part of the test path.
      if (unit.rootMirror === true || unit.sourceRoots.some(root => isUnder(rel, root) && rel !== root)) {
        bases.push(joinPath(unit.dir, rel))
      }
    }
    else {
      for (const root of [...unit.sourceRoots, ...(withAlternates ? unit.alternateSourceRoots ?? [] : [])]) {
        bases.push(joinPath(unit.dir, root, rel))
      }
    }
  }
  const out: string[] = []
  for (const base of bases) {
    for (const ext of layout.sourceExtensions) {
      out.push(`${base}${ext}`)
    }
    if (layout.allowIndex) {
      for (const ext of layout.sourceExtensions) {
        out.push(`${base}/index${ext}`)
      }
    }
  }
  return out
}

function describeExpected(candidates: string[], unit: Unit, layout: TestLayout): string {
  if (candidates.length === 0) {
    // Several source roots and the test path does not start with one of them.
    return `a path starting with ${unit.sourceRoots.map(r => `${r}/`).join(', ')}`
  }
  const primary = candidates.filter(c => c.endsWith(layout.sourceExtensions[0] ?? '') && !c.includes('/index.'))
  return (primary.length > 0 ? primary : candidates).slice(0, 3).join(', ')
}

type TestFileOutcome = Finding | 'fixture' | null

function outsideRootFinding(file: string, unit: Unit, layout: TestLayout): Finding {
  return {
    slug: SLUG,
    kind: 'test-outside-root',
    severity: 'warning',
    language: layout.language,
    file,
    message: `Test file is outside the test root. Move it under ${unit.testRoots.map(r => `${joinPath(unit.dir, r)}/`).join(' or ')}, mirroring the path of the source it tests.`,
  }
}

function orphanFinding(file: string, testRoot: string, candidates: string[], unit: Unit, layout: TestLayout): Finding {
  return {
    slug: SLUG,
    kind: 'orphan-test',
    severity: 'warning',
    language: layout.language,
    file,
    message: `No source file matches this test's path (expected ${describeExpected(candidates, unit, layout)}). Move the test to mirror the path of the source it tests; a test with no single source file belongs under ${joinPath(unit.dir, testRoot)}/e2e/.`,
  }
}

/** Classifies one test file of a unit: a finding, `'fixture'` when it belongs to a fixture project, or `null` when it is fine or exempt. */
function inspectUnitTestFile(file: string, unit: Unit, layout: TestLayout, fileSet: Set<string>): TestFileOutcome {
  const rel = relativeTo(file, unit.dir)
  // A fixture project's tests are inputs to the enclosing package's tests, not tests of its sources.
  if (unit.fixtureDirs?.some(dir => isUnder(rel, dir)) === true) {
    return 'fixture'
  }
  const testRoot = unit.testRoots.find(root => isUnder(rel, root) && rel !== root)
  if (testRoot == null) {
    return layout.reportOutsideRoot(rel) ? outsideRootFinding(file, unit, layout) : null
  }
  if (layout.helperDirs(unit).some(dir => isUnder(rel, dir))) {
    return null
  }
  const inner = relativeTo(rel, testRoot)
  const first = inner.split('/')[0] ?? ''
  if (inner.includes('/') && E2E_SEGMENTS.includes(first)) {
    return null
  }
  const candidates = candidateSources(inner, unit, layout, false)
  if (candidates.some(c => fileSet.has(c)) || candidateSources(inner, unit, layout).some(c => fileSet.has(c))) {
    return null
  }
  return orphanFinding(file, testRoot, candidates, unit, layout)
}

/** Aggregated notices for the test files of `layout` that were not checked. */
function skippedNotices(layout: TestLayout, unitless: string[], inFixtures: string[]): string[] {
  const notices: string[] = []
  if (unitless.length > 0) {
    notices.push(`${LANGUAGE_LABEL[layout.language]}: test-path check skipped ${unitless.length} test file(s) outside any package (${UNIT_MARKER[layout.language]}): ${exampleList(unitless)}`)
  }
  if (inFixtures.length > 0) {
    notices.push(`${LANGUAGE_LABEL[layout.language]}: test-path check skipped ${inFixtures.length} test file(s) inside fixture projects (a ${layout.language === 'dart' ? 'pubspec.yaml' : 'package.json'} under a test root): ${exampleList(inFixtures)}`)
  }
  return notices
}

/**
 * `test-path-derivable-from-source` for path-derived languages: reports tests
 * whose source cannot be derived (orphans) and tests outside the test root.
 * Sources without tests are never reported. Adds one aggregated notice per
 * language for the test files that belong to no package or module and so are
 * not checked.
 */
export function inspectTestPaths(
  files: string[],
  layouts: readonly TestLayout[],
  base: CodeOrganizationConfig,
  rootDir: string,
): { findings: Finding[], notices: string[] } {
  const fileSet = new Set(files)
  const findings: Finding[] = []
  const notices: string[] = []
  for (const layout of layouts) {
    const units = layout.units(files, base, rootDir)
    const unitless: string[] = []
    const inFixtures: string[] = []
    for (const file of files) {
      if (!layout.isTestFile(file)) {
        continue
      }
      const unit = unitOf(file, units)
      const outcome = unit == null ? null : inspectUnitTestFile(file, unit, layout, fileSet)
      if (unit == null) {
        unitless.push(file)
      }
      else if (outcome === 'fixture') {
        inFixtures.push(file)
      }
      else if (outcome != null) {
        findings.push(outcome)
      }
    }
    notices.push(...skippedNotices(layout, unitless, inFixtures))
  }
  return { findings, notices }
}
