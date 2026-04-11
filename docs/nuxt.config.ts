import process from 'node:process'

export default defineNuxtConfig({
  extends: ['docus'],

  modules: [
    '@nuxtjs/i18n',
    // Docus ships with two pages that collide with @nuxtjs/i18n's `prefix`
    // strategy (which Docus forces on when locales are configured):
    //
    //   1. `lang-index` at path `/:lang?` — intended for the non-i18n case
    //      where `:lang` is captured manually. With @nuxtjs/i18n it expands
    //      to `/en/:lang?` and `/ko/:lang?`, which greedily match localised
    //      sub-pages like `/ko/cli` (with `lang='cli'`) and render the
    //      landing page instead of the actual doc.
    //
    //   2. `[[lang]]/[...slug]` file page at `/:lang?/:slug(.*)*` — same
    //      issue: after prefixing it becomes `/en/:lang?/:slug(.*)*`, and
    //      the redundant `:lang?` gets eagerly filled before `:slug`.
    //
    // Both can be fixed by stripping the redundant `:lang?` param from the
    // path templates. @nuxtjs/i18n's prefix strategy already injects the
    // locale, so we don't need Docus's manual fallback.
    //
    // This is registered as an inline module (rather than a nuxt.config
    // `hooks.pages:extend`) so that its callback runs AFTER Docus's routing
    // module has added these pages — config-level hooks register before any
    // module setup runs.
    (_options, nuxt) => {
      nuxt.hook('pages:extend', (pages) => {
        for (const page of pages) {
          if (page.name === 'lang-index' && page.path === '/:lang?') {
            page.path = '/'
          }
          if (page.path === '/:lang?/:slug(.*)*') {
            page.path = '/:slug(.*)*'
          }
        }
      })
    },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English' },
      { code: 'ko', name: '한국어' },
    ],
  },

  content: {
    database: process.env.NUXT_CONTENT_DATABASE_TYPE === 'd1'
      ? { type: 'd1' as const, bindingName: 'DB' }
      : { type: 'sqlite' as const },
    experimental: {
      sqliteConnector: 'native',
    },
  },

  mcp: {
    enabled: false,
  },

  nitro: {
    preset: 'cloudflare_pages',
  },

  compatibilityDate: '2026-04-08',
})
