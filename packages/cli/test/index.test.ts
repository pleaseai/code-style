import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const CLI = fileURLToPath(new URL('../src/index.ts', import.meta.url))

function run(args: string[], cwd?: string): { status: number | null, stdout: string, stderr: string } {
  const env = { ...process.env, LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8', LC_MESSAGES: 'en_US.UTF-8' }
  const res = spawnSync('bun', [CLI, ...args], { encoding: 'utf-8', env, cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  return { status: res.status, stdout: res.stdout, stderr: res.stderr }
}

describe('locale flags', () => {
  test('--locale sets the message language', () => {
    const res = run(['--locale', 'ko', '--help'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('사용법:')
    expect(res.stderr).toBe('')
  })

  test('--lang ko warns that it moved to --locale and still sets the locale', () => {
    const res = run(['--lang', 'ko', '--help'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('사용법:')
    expect(res.stderr).toContain('--locale ko')
  })

  test('--lang overridden by --locale is reported as ignored, not as the migration target', () => {
    const res = run(['--locale', 'en', '--lang', 'ko', '--help'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('Usage:')
    expect(res.stderr).toContain('--lang ko is deprecated and ignored because --locale is set; remove it.')
  })
})

describe('--lang languages', () => {
  test('an unknown value exits non-zero and lists the accepted languages', () => {
    const res = run(['--lang', 'foo', '--help'])
    expect(res.status).toBe(1)
    expect(res.stdout).toBe('')
    expect(res.stderr).toContain('Unknown --lang value: "foo"')
    expect(res.stderr).toContain('typescript')
    expect(res.stderr).toContain('html-css')
    expect(res.stderr).toContain('--locale <ko|en>')
  })

  test('update --lang dart links the dart guide instead of the TypeScript one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pleaseai-cli-lang-'))
    try {
      writeFileSync(join(dir, 'package.json'), '{}')
      const res = run(['update', '--lang', 'dart'], dir)
      expect(res.status).toBe(0)
      const body = readFileSync(join(dir, 'AGENTS.md'), 'utf-8')
      expect(body).toContain('rules/dart.md')
      expect(body).not.toContain('rules/typescript.md')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
