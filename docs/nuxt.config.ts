import process from 'node:process'

export default defineNuxtConfig({
  extends: ['docus'],

  modules: ['@nuxtjs/i18n'],

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
