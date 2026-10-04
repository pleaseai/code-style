import { afterEach, describe, expect, test } from 'bun:test'
import { mergeConfigs, readConfigFile } from '../../src/check/config.js'
import { ConfigError } from '../../src/check/errors.js'
import { createFixture } from '../test-utils/fixture.js'

let cleanup = (): void => {}
afterEach(() => cleanup())

function configFile(contents: string): string {
  const fixture = createFixture({ 'code-organization.json': contents })
  cleanup = fixture.cleanup
  return `${fixture.root}/code-organization.json`
}

describe('readConfigFile', () => {
  test('a missing file adds nothing', () => {
    expect(readConfigFile('/nonexistent/code-organization.json')).toEqual({ sourceRoots: [], envSegments: [] })
  })

  test('reads additional source roots and env segments, normalizing paths', () => {
    const file = configFile(JSON.stringify({ sourceRoots: ['./lib/', 'packages/core'], envSegments: ['integration'] }))
    expect(readConfigFile(file)).toEqual({ sourceRoots: ['lib', 'packages/core'], envSegments: ['integration'] })
  })

  test.each([
    ['unknown keys', { testRoot: 'src' }],
    ['non-array values', { sourceRoots: 'src' }],
    ['paths leaving the package', { sourceRoots: ['../src'] }],
    ['absolute paths', { sourceRoots: ['/src'] }],
    ['nested env segments', { envSegments: ['unit/fast'] }],
  ])('rejects %s', (_label, value) => {
    expect(() => readConfigFile(configFile(JSON.stringify(value)))).toThrow(ConfigError)
  })

  test('rejects invalid JSON', () => {
    expect(() => readConfigFile(configFile('{'))).toThrow(ConfigError)
  })
})

describe('mergeConfigs', () => {
  test('only ever adds names', () => {
    expect(mergeConfigs(
      { sourceRoots: ['lib'], envSegments: ['integration'] },
      { sourceRoots: ['lib', 'shared'], envSegments: [] },
    )).toEqual({ sourceRoots: ['lib', 'shared'], envSegments: ['integration'] })
  })
})
