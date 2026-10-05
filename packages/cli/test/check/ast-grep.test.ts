import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'bun:test'
import { resolutionAnchors, resolveToolchain, runExtraction } from '../../src/check/ast-grep.js'
import { MissingDependencyError } from '../../src/check/errors.js'
import { checkFixture, createFixture } from '../test-utils/fixture.js'

let cleanup = (): void => {}
afterEach(() => cleanup())

/** The shim name `astGrepBinary` looks for on this platform. */
const SHIM = process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep'

describe('resolveToolchain', () => {
  test('prefers the checked project\'s @ast-grep/cli but the CLI\'s own @pleaseai/ast-grep-config extract rules', () => {
    const fixture = createFixture({
      'package.json': '{}',
      'node_modules/@ast-grep/cli/package.json': '{"name":"@ast-grep/cli"}',
      'node_modules/@ast-grep/cli/postinstall.js': 'exports.resolveBinaryPath = () => null',
      [`node_modules/@ast-grep/cli/${SHIM}`]: '',
      'node_modules/@pleaseai/ast-grep-config/package.json': '{"name":"@pleaseai/ast-grep-config"}',
    })
    cleanup = fixture.cleanup
    const modules = join(fixture.root, 'node_modules')
    expect(resolveToolchain(resolutionAnchors(fixture.root))).toEqual({
      bin: join(modules, '@ast-grep/cli', SHIM),
      extractDir: resolveToolchain([fileURLToPath(import.meta.url)]).extractDir,
    })
    expect(resolveToolchain(resolutionAnchors(fixture.root)).extractDir).not.toStartWith(modules)
  })

  test('names only @pleaseai/ast-grep-config when the binary resolves but the config does not', () => {
    const fixture = createFixture({
      'package.json': '{}',
      'node_modules/@ast-grep/cli/package.json': '{"name":"@ast-grep/cli"}',
      'node_modules/@ast-grep/cli/postinstall.js': 'exports.resolveBinaryPath = () => null',
      [`node_modules/@ast-grep/cli/${SHIM}`]: '',
    })
    cleanup = fixture.cleanup
    const anchor = join(fixture.root, 'package.json')
    expect(() => resolveToolchain([anchor])).toThrow('cannot resolve @pleaseai/ast-grep-config')
  })

  test('falls back to the CLI\'s own install, and names the project install when no binary resolves', () => {
    const fixture = createFixture({ 'package.json': '{}' })
    cleanup = fixture.cleanup
    expect(resolveToolchain(resolutionAnchors(fixture.root)).extractDir).toEndWith(join('ast-grep-config', 'extract'))
    expect(() => resolveToolchain([join(fixture.root, 'package.json')])).toThrow(MissingDependencyError)
    expect(() => resolveToolchain([join(fixture.root, 'package.json')]))
      .toThrow('bun add -D @ast-grep/cli')
  })
})

describe('runExtraction', () => {
  test('ignores the checked project\'s sgconfig.yml', () => {
    const fixture = createFixture({
      'package.json': '{}',
      'sgconfig.yml': 'ruleDirs: []\nlanguageGlobs:\n  tsx: ["*.ts"]\n',
      'src/zed.ts': 'export function Zed() {}',
    })
    cleanup = fixture.cleanup
    expect(runExtraction(fixture.root, 'typescript').map(m => m.text)).toEqual(['Zed'])
  })
})

describe('checkCodeOrganization file set', () => {
  test('does not report files in ignored directories of a non-git root', () => {
    const result = checkFixture({
      'package.json': '{}',
      'node_modules/pkg/foo.ts': 'export function Zed() {}',
      'dist/bar.ts': 'export function Zed() {}',
    })
    expect(result.findings).toEqual([])
  })
})
