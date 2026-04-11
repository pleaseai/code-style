import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  buildMarkerBlock,
  detectPackageManager,
  installCommand,
  isPackageInstalled,
  readPackageJson,
  upsertMarkerBlock,
  writePackageJson,
} from './fs-utils.js'

// ---------------------------------------------------------------------------
// detectPackageManager
// ---------------------------------------------------------------------------

describe('detectPackageManager', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-test-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('returns bun for bun.lock', () => {
    writeFileSync(join(dir, 'bun.lock'), '')
    expect(detectPackageManager(dir)).toBe('bun')
  })

  test('returns bun for bun.lockb', () => {
    writeFileSync(join(dir, 'bun.lockb'), '')
    expect(detectPackageManager(dir)).toBe('bun')
  })

  test('returns pnpm for pnpm-lock.yaml', () => {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
    expect(detectPackageManager(dir)).toBe('pnpm')
  })

  test('returns yarn for yarn.lock', () => {
    writeFileSync(join(dir, 'yarn.lock'), '')
    expect(detectPackageManager(dir)).toBe('yarn')
  })

  test('returns npm for package-lock.json', () => {
    writeFileSync(join(dir, 'package-lock.json'), '')
    expect(detectPackageManager(dir)).toBe('npm')
  })

  test('defaults to bun when no lockfile exists', () => {
    expect(detectPackageManager(dir)).toBe('bun')
  })

  test('bun wins over pnpm when both lockfiles are present', () => {
    // Bun is probed first in PM_LOCKFILES order; this encodes PleaseAI's
    // "bun-first" preference and guards against accidental reordering.
    writeFileSync(join(dir, 'bun.lock'), '')
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
    expect(detectPackageManager(dir)).toBe('bun')
  })
})

// ---------------------------------------------------------------------------
// installCommand
// ---------------------------------------------------------------------------

describe('installCommand', () => {
  test('bun → bun add -d', () => {
    expect(installCommand('bun', ['a', 'b'])).toEqual(['bun', ['add', '-d', 'a', 'b']])
  })

  test('pnpm → pnpm add -D', () => {
    expect(installCommand('pnpm', ['a'])).toEqual(['pnpm', ['add', '-D', 'a']])
  })

  test('yarn → yarn add -D', () => {
    expect(installCommand('yarn', ['a'])).toEqual(['yarn', ['add', '-D', 'a']])
  })

  test('npm → npm install -D', () => {
    expect(installCommand('npm', ['a'])).toEqual(['npm', ['install', '-D', 'a']])
  })
})

// ---------------------------------------------------------------------------
// isPackageInstalled
// ---------------------------------------------------------------------------

describe('isPackageInstalled', () => {
  test('finds package in dependencies', () => {
    const pkg = { dependencies: { react: '^18' } }
    expect(isPackageInstalled(pkg, 'react')).toBe(true)
  })

  test('finds package in devDependencies', () => {
    const pkg = { devDependencies: { eslint: '^10' } }
    expect(isPackageInstalled(pkg, 'eslint')).toBe(true)
  })

  test('returns false when package is absent', () => {
    expect(isPackageInstalled({ dependencies: {} }, 'react')).toBe(false)
  })

  test('returns false for empty package.json', () => {
    expect(isPackageInstalled({}, 'react')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// readPackageJson / writePackageJson
// ---------------------------------------------------------------------------

describe('package.json I/O', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-test-'))
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', version: '1.0.0' }))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('roundtrips through read + write', () => {
    const pkg = readPackageJson(dir)
    pkg.prettier = '@pleaseai/prettier-config'
    writePackageJson(pkg, dir)

    const reread = readPackageJson(dir)
    expect(reread.name).toBe('demo')
    expect(reread.prettier).toBe('@pleaseai/prettier-config')
  })
})

// ---------------------------------------------------------------------------
// buildMarkerBlock / upsertMarkerBlock
// ---------------------------------------------------------------------------

describe('buildMarkerBlock', () => {
  test('wraps body between start and end markers', () => {
    const block = buildMarkerBlock('hello')
    expect(block).toBe(
      '<!-- pleaseai-code-style:start -->\nhello\n<!-- pleaseai-code-style:end -->',
    )
  })

  test('trims whitespace around body', () => {
    const block = buildMarkerBlock('  \n hello \n  ')
    expect(block).toContain('\nhello\n')
  })
})

describe('upsertMarkerBlock', () => {
  const body = 'RULES'

  test('creates block when file does not exist', () => {
    const result = upsertMarkerBlock(null, body)
    expect(result).toContain('<!-- pleaseai-code-style:start -->')
    expect(result).toContain('RULES')
    expect(result).toContain('<!-- pleaseai-code-style:end -->')
    expect(result.endsWith('\n')).toBe(true)
  })

  test('appends block when file has no existing marker', () => {
    const existing = '# Existing header\n\nSome user content.\n'
    const result = upsertMarkerBlock(existing, body)

    expect(result.startsWith('# Existing header')).toBe(true)
    expect(result).toContain('Some user content.')
    expect(result).toContain('RULES')
  })

  test('replaces block content when marker already exists', () => {
    const existing = '# Header\n\n<!-- pleaseai-code-style:start -->\nOLD\n<!-- pleaseai-code-style:end -->\n\n## Footer\n'
    const result = upsertMarkerBlock(existing, body)

    expect(result).toContain('# Header')
    expect(result).toContain('## Footer')
    expect(result).toContain('RULES')
    expect(result).not.toContain('OLD')
  })

  test('is idempotent when applied twice with the same body', () => {
    const first = upsertMarkerBlock(null, body)
    const second = upsertMarkerBlock(first, body)
    expect(second).toBe(first)
  })

  test('does not duplicate the block on repeated runs', () => {
    const first = upsertMarkerBlock('# Header\n', body)
    const second = upsertMarkerBlock(first, body)
    const third = upsertMarkerBlock(second, body)

    const startCount = (third.match(/pleaseai-code-style:start/g) ?? []).length
    const endCount = (third.match(/pleaseai-code-style:end/g) ?? []).length
    expect(startCount).toBe(1)
    expect(endCount).toBe(1)
  })

  test('preserves content outside the marker block verbatim', () => {
    const existing = '# Header\n\n<!-- pleaseai-code-style:start -->\nOLD\n<!-- pleaseai-code-style:end -->\n\n## Footer\n- keep me\n'
    const result = upsertMarkerBlock(existing, body)
    expect(result).toContain('# Header')
    expect(result).toContain('## Footer\n- keep me')
  })
})
