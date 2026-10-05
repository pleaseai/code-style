import type { CodeOrganizationConfig } from './config.js'
import type { Language } from './types.js'
import { join } from 'node:path'
import { packageConfig } from './config.js'

/**
 * A directory that owns one test root: a package (`package.json`,
 * `pubspec.yaml`) or a Gradle/Maven module (`src/main/<lang>`).
 */
export interface Unit {
  /** Path relative to the checked root (`''` for the root itself). */
  dir: string
  /** Test roots relative to `dir`. */
  testRoots: string[]
  /** Source roots relative to `dir`. */
  sourceRoots: string[]
  /** Further roots a test's source may live in, used only to match candidates (never named in a message). */
  alternateSourceRoots?: string[]
  /** With several source roots the root name stays in the test path (ADR-0022 §3). */
  keepRootName: boolean
  /** Allowed environment segments directly under a test root. */
  envSegments: string[]
  /** Fixture projects (a `package.json` under a test root) relative to `dir`; their test files are test data. */
  fixtureDirs?: string[]
}

/**
 * Per-language path rules (ADR-0022 §3: path derivation is, with name
 * normalization, the only language-specific part of the checker).
 */
export interface TestLayout {
  language: Exclude<Language, 'rust'>
  units: (files: string[], base: CodeOrganizationConfig, rootDir: string) => Unit[]
  /** Does this file name mark a test file? */
  isTestFile: (path: string) => boolean
  /** `foo.test.ts` → `foo`, `foo_test.dart` → `foo`, `FooTest.kt` → `Foo`. */
  sourceStem: (fileName: string) => string
  /** Candidate source extensions for a derived stem. */
  sourceExtensions: string[]
  /** Also accept `<stem>/index.<ext>` as the source. */
  allowIndex: boolean
  /** Designated shared-helper directory, relative to the unit (per test root). */
  helperDirs: (unit: Unit) => string[]
  /** Report a test file found in `rel` (relative to its unit) outside the test roots? */
  reportOutsideRoot: (rel: string) => boolean
}

export function isUnder(path: string, dir: string): boolean {
  return dir === '' || path === dir || path.startsWith(`${dir}/`)
}

export function relativeTo(path: string, dir: string): string {
  return dir === '' ? path : path.slice(dir.length + 1)
}

export function joinPath(...parts: string[]): string {
  return parts.filter(p => p !== '').join('/')
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function withConfig(rootDir: string, dir: string, base: CodeOrganizationConfig): CodeOrganizationConfig {
  // `--config` replaces the root file instead of merging with it.
  if (dir === '' && base.explicit === true) {
    return base
  }
  return packageConfig(base, join(rootDir, dir))
}

// --- TypeScript -------------------------------------------------------------

const TS_TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const NUXT_CONFIG = /^nuxt\.config\.[cm]?[jt]s$/
/** Default source roots: `src/`, or Nuxt 4's `app/` (srcDir), `server/`, `shared/`. */
const DEFAULT_TS_ROOTS = ['src']
const TS_TEST_ROOTS = ['test', 'tests']
const NUXT_ROOTS = ['app', 'server', 'shared']

export const TYPESCRIPT_LAYOUT: TestLayout = {
  language: 'typescript',
  units(files, base, rootDir) {
    const dirs = files.filter(f => baseName(f) === 'package.json').map(dirOf).sort((a, b) => a.length - b.length)
    // A `package.json` under an enclosing unit's test root is test data (a fixture project), not a unit.
    const kept: string[] = []
    const fixtures = new Map<string, string[]>()
    for (const dir of dirs) {
      const owner = kept.find(k => dir !== k && isUnder(dir, k) && TS_TEST_ROOTS.some(root => isUnder(relativeTo(dir, k), root)))
      if (owner == null) {
        kept.push(dir)
      }
      else {
        fixtures.set(owner, [...(fixtures.get(owner) ?? []), relativeTo(dir, owner)])
      }
    }
    return kept.map((dir) => {
      const isNuxt = files.some(f => dirOf(f) === dir && NUXT_CONFIG.test(baseName(f)))
      const config = withConfig(rootDir, dir, base)
      const sourceRoots = [...new Set([...(isNuxt ? NUXT_ROOTS : DEFAULT_TS_ROOTS), ...config.sourceRoots])]
      return {
        dir,
        testRoots: TS_TEST_ROOTS,
        sourceRoots,
        keepRootName: sourceRoots.length > 1,
        envSegments: config.envSegments,
        fixtureDirs: fixtures.get(dir),
      }
    })
  },
  isTestFile: path => TS_TEST.test(path),
  sourceStem: fileName => fileName.replace(TS_TEST, ''),
  sourceExtensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue'],
  allowIndex: true,
  helperDirs: unit => unit.testRoots.map(r => `${r}/test-utils`),
  // e2e tests have no source counterpart wherever they live (ADR-0022 §1).
  reportOutsideRoot: rel => !rel.split('/').includes('e2e'),
}

// --- Dart -------------------------------------------------------------------

const DART_TEST = /_test\.dart$/

export const DART_LAYOUT: TestLayout = {
  language: 'dart',
  units(files, base, rootDir) {
    return files.filter(f => baseName(f) === 'pubspec.yaml').map(dirOf).map(dir => ({
      dir,
      testRoots: ['test'],
      sourceRoots: ['lib'],
      keepRootName: false,
      envSegments: withConfig(rootDir, dir, base).envSegments,
    }))
  },
  isTestFile: path => DART_TEST.test(path),
  sourceStem: fileName => fileName.replace(DART_TEST, ''),
  sourceExtensions: ['.dart'],
  allowIndex: false,
  helperDirs: () => ['test/helpers'],
  // Flutter's integration_test/ and test_driver/ hold end-to-end tests.
  reportOutsideRoot: rel => !/^(?:integration_test|test_driver)\//.test(rel),
}

// --- Kotlin / Java (Gradle / Maven) -----------------------------------------

function jvmLayout(language: 'kotlin' | 'java', ext: '.kt' | '.java'): TestLayout {
  // Gradle/Maven modules mix both languages: a test may target a source in the sibling-language main set.
  const sibling = language === 'kotlin' ? 'java' : 'kotlin'
  const siblingExt = ext === '.kt' ? '.java' : '.kt'
  const test = new RegExp(`.Test\\${ext}$`)
  const sourceSet = new RegExp(`^(?:(.*)/)?src/(?:main|test|testFixtures)/${language}/`)
  return {
    language,
    units(files, base, rootDir) {
      const dirs = new Set<string>()
      for (const f of files) {
        const m = sourceSet.exec(f)
        if (m != null) {
          dirs.add(m[1] ?? '')
        }
      }
      return [...dirs].map(dir => ({
        dir,
        testRoots: [`src/test/${language}`],
        sourceRoots: [`src/main/${language}`],
        alternateSourceRoots: [`src/main/${sibling}`],
        keepRootName: false,
        envSegments: withConfig(rootDir, dir, base).envSegments,
      }))
    },
    isTestFile: path => test.test(path),
    sourceStem: fileName => fileName.slice(0, -`Test${ext}`.length),
    sourceExtensions: [ext, siblingExt],
    allowIndex: false,
    helperDirs: () => ['src/testFixtures'],
    // Only a test class inside production sources is misplaced; other source
    // sets (androidTest, integrationTest, …) are their own test roots.
    reportOutsideRoot: rel => rel.startsWith('src/main/'),
  }
}

export const KOTLIN_LAYOUT: TestLayout = jvmLayout('kotlin', '.kt')
export const JAVA_LAYOUT: TestLayout = jvmLayout('java', '.java')

export const TEST_LAYOUTS: readonly TestLayout[] = [TYPESCRIPT_LAYOUT, DART_LAYOUT, KOTLIN_LAYOUT, JAVA_LAYOUT]

/** The deepest unit that contains `path`. */
export function unitOf(path: string, units: Unit[]): Unit | undefined {
  let best: Unit | undefined
  for (const unit of units) {
    if (isUnder(path, unit.dir) && (best == null || unit.dir.length > best.dir.length)) {
      best = unit
    }
  }
  return best
}
