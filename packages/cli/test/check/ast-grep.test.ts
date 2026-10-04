import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { resolutionAnchors, resolveToolchain, runExtraction } from '../../src/check/ast-grep.js'
import { MissingDependencyError } from '../../src/check/errors.js'
import { checkFixture, createFixture } from '../test-utils/fixture.js'

let cleanup = (): void => {}
afterEach(() => cleanup())

describe('resolveToolchain', () => {
  test('prefers the checked project\'s own @ast-grep/cli and @pleaseai/ast-grep-config', () => {
    const fixture = createFixture({
      'package.json': '{}',
      'node_modules/@ast-grep/cli/package.json': '{"name":"@ast-grep/cli"}',
      'node_modules/@ast-grep/cli/postinstall.js': 'exports.resolveBinaryPath = () => null',
      'node_modules/@ast-grep/cli/ast-grep': '',
      'node_modules/@pleaseai/ast-grep-config/package.json': '{"name":"@pleaseai/ast-grep-config"}',
    })
    cleanup = fixture.cleanup
    const modules = join(fixture.root, 'node_modules')
    expect(resolveToolchain(resolutionAnchors(fixture.root))).toEqual({
      bin: join(modules, '@ast-grep/cli/ast-grep'),
      extractDir: join(modules, '@pleaseai/ast-grep-config/extract'),
    })
  })

  test('falls back to the CLI\'s own install, and names both packages when neither resolves', () => {
    const fixture = createFixture({ 'package.json': '{}' })
    cleanup = fixture.cleanup
    expect(resolveToolchain(resolutionAnchors(fixture.root)).extractDir).toEndWith(join('ast-grep-config', 'extract'))
    expect(() => resolveToolchain([join(fixture.root, 'package.json')])).toThrow(MissingDependencyError)
    expect(() => resolveToolchain([join(fixture.root, 'package.json')]))
      .toThrow('bun add -D @pleaseai/ast-grep-config @ast-grep/cli')
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
