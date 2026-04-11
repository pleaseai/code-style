import process from 'node:process'
import { afterEach, describe, expect, test } from 'bun:test'
import { detectLocale, setLocale, t } from './i18n.js'

describe('detectLocale', () => {
  const originalLang = process.env.LANG
  const originalLcAll = process.env.LC_ALL
  const originalLcMessages = process.env.LC_MESSAGES

  afterEach(() => {
    process.env.LANG = originalLang
    process.env.LC_ALL = originalLcAll
    process.env.LC_MESSAGES = originalLcMessages
  })

  test('returns "ko" when override is "ko"', () => {
    expect(detectLocale('ko')).toBe('ko')
  })

  test('returns "en" when override is "en"', () => {
    expect(detectLocale('en')).toBe('en')
  })

  test('falls back to LANG env when no override', () => {
    delete process.env.LC_ALL
    delete process.env.LC_MESSAGES
    process.env.LANG = 'ko_KR.UTF-8'
    expect(detectLocale()).toBe('ko')
  })

  test('returns "en" when LANG is English', () => {
    delete process.env.LC_ALL
    delete process.env.LC_MESSAGES
    process.env.LANG = 'en_US.UTF-8'
    expect(detectLocale()).toBe('en')
  })

  test('LC_ALL takes priority over LANG', () => {
    process.env.LC_ALL = 'ko_KR.UTF-8'
    process.env.LANG = 'en_US.UTF-8'
    expect(detectLocale()).toBe('ko')
  })

  test('returns "en" for unknown/empty locale', () => {
    delete process.env.LC_ALL
    delete process.env.LC_MESSAGES
    delete process.env.LANG
    expect(detectLocale()).toBe('en')
  })

  test('ignores invalid override values and falls through to env', () => {
    delete process.env.LC_ALL
    delete process.env.LC_MESSAGES
    process.env.LANG = 'ko_KR.UTF-8'
    // Only 'ko' / 'en' are valid overrides; anything else is ignored.
    expect(detectLocale('fr')).toBe('ko')
  })
})

describe('t (translation lookup)', () => {
  test('returns English messages when locale is en', () => {
    setLocale('en')
    expect(t('done')).toBe('Done!')
    expect(t('detectedPm')('bun')).toBe('Detected package manager: bun')
  })

  test('returns Korean messages when locale is ko', () => {
    setLocale('ko')
    expect(t('done')).toBe('완료!')
    expect(t('detectedPm')('bun')).toBe('감지된 패키지 매니저: bun')
  })

  test('setLocale switches the active language', () => {
    setLocale('en')
    const en = t('done')
    setLocale('ko')
    const ko = t('done')
    expect(en).not.toBe(ko)
  })

  test('function-valued messages return formatted strings', () => {
    setLocale('en')
    expect(t('overwritePrompt')('foo.txt')).toBe('foo.txt already exists. Overwrite?')
    expect(t('unknownCommand')('bogus')).toBe('Unknown command: bogus')
  })
})
