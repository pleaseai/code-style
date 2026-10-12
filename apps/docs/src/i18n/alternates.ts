import type { Locale } from './locales'
import { getIndexedEntries } from '@cloudflare/nimbus-docs/runtime'
import { getLocaleFromPath, isLocale, locales, toPagePath, translatePath } from './locales'

export interface LocaleAlternate {
  locale: Locale
  /** Base-stripped, slash-less path of the page in `locale`. */
  path: string
  /** Whether this alternate is the page being rendered. */
  current: boolean
}

let pageUrls: Promise<Set<string>> | undefined

/** Every built docs page URL, normalized without a trailing slash. */
async function getPageUrls(): Promise<Set<string>> {
  pageUrls ??= getIndexedEntries().then(entries => new Set(entries.map(({ url }) => toPagePath(url))))
  return pageUrls
}

/**
 * The current page in every locale that has a translation of it, in
 * `locales` order. Empty for pages outside a locale prefix (e.g. `/404`),
 * which have no counterpart to switch to.
 */
export async function getLocaleAlternates(pathname: string): Promise<LocaleAlternate[]> {
  const path = toPagePath(pathname)
  if (!isLocale(path.split('/')[1])) {
    return []
  }
  const current = getLocaleFromPath(path)
  const urls = await getPageUrls()
  return locales
    .map(locale => ({ locale, path: translatePath(path, locale), current: locale === current }))
    .filter(alternate => alternate.current || urls.has(alternate.path))
}
