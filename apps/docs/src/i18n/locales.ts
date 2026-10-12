/**
 * Locales served by the docs site. Imported by `astro.config.ts` (Astro's
 * `i18n` routing) and by the layouts, so the list lives in one place.
 *
 * Content for each locale lives under `src/content/docs/<locale>/`; the
 * locale is always the first URL segment (`/en/...`, `/ko/...`).
 */
export const locales = ['en', 'ko'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** Label shown in the language switcher, in the locale's own language. */
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
}

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value)
}

/**
 * Page path of a base-stripped pathname, without a trailing slash, `.html`
 * suffix, or `/index` segment: `/ko.html` and `/ko/` both become `/ko`.
 * (Static builds use `build.format: 'file'`, so a prerendered pathname may
 * carry the output file name.)
 */
export function toPagePath(pathname: string): string {
  return pathname.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '') || '/'
}

/**
 * Locale of a base-stripped pathname (e.g. `/ko/cli` → `ko`). Paths outside
 * a locale prefix (`/`, `/404`) fall back to the default locale.
 */
export function getLocaleFromPath(pathname: string): Locale {
  const segment = toPagePath(pathname).split('/').find(Boolean)
  return isLocale(segment) ? segment : defaultLocale
}

/**
 * The same page in another locale: swaps the leading locale segment of a
 * base-stripped pathname. Paths without a locale prefix map to the target
 * locale's landing page.
 */
export function translatePath(pathname: string, target: Locale): string {
  const segments = toPagePath(pathname).split('/').filter(Boolean)
  if (isLocale(segments[0])) {
    segments[0] = target
    return `/${segments.join('/')}`
  }
  return `/${target}`
}

/** Interface strings owned by this site's i18n wiring (not Nimbus chrome). */
export const ui: Record<Locale, { home: string, language: string }> = {
  en: { home: 'Home', language: 'Language' },
  ko: { home: '홈', language: '언어' },
}
