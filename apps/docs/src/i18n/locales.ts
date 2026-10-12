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

interface UiStrings {
  home: string
  language: string
  aside: Record<'note' | 'tip' | 'caution' | 'danger', string>
  previous: string
  next: string
  search: {
    label: string
    placeholder: string
    empty: string
    searching: string
    noResults: string
    unavailable: string
    navigate: string
    select: string
    close: string
  }
}

/**
 * Interface strings for the site's own i18n wiring and the localized Nimbus
 * UI primitives (Aside, Pagination, SearchDialog).
 */
export const ui: Record<Locale, UiStrings> = {
  en: {
    home: 'Home',
    language: 'Language',
    aside: { note: 'Note', tip: 'Tip', caution: 'Caution', danger: 'Danger' },
    previous: 'Previous',
    next: 'Next',
    search: {
      label: 'Search documentation',
      placeholder: 'Search documentation…',
      empty: 'Type to search…',
      searching: 'Searching…',
      noResults: 'No results found.',
      unavailable: 'Search is temporarily unavailable.',
      navigate: '↑↓ navigate',
      select: '↵ select',
      close: 'Esc close',
    },
  },
  ko: {
    home: '홈',
    language: '언어',
    aside: { note: '참고', tip: '팁', caution: '주의', danger: '경고' },
    previous: '이전',
    next: '다음',
    search: {
      label: '문서 검색',
      placeholder: '문서 검색…',
      empty: '검색어를 입력하세요…',
      searching: '검색 중…',
      noResults: '검색 결과가 없습니다.',
      unavailable: '지금은 검색을 사용할 수 없습니다.',
      navigate: '↑↓ 이동',
      select: '↵ 선택',
      close: 'Esc 닫기',
    },
  },
}
