import nimbus, {
  defineConfig as defineNimbusConfig,
} from '@cloudflare/nimbus-docs'
import { tableScroll } from '@cloudflare/nimbus-docs/markdown'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { defaultLocale, locales } from './src/i18n/locales'

const nimbusConfig = defineNimbusConfig({
  // Canonical origin (no trailing slash). Drives canonical URLs, absolute OG
  // image URLs, robots.txt, sitemap, and the links in /llms.txt.
  site: 'https://code-style.pages.dev',
  title: 'PleaseAI Code Style',
  description: 'Shared code style configurations for PleaseAI projects',
  // Fallback only: BaseLayout sets <html lang> per page from the URL locale.
  locale: defaultLocale,
  github: 'https://github.com/pleaseai/code-style',
  editPattern: 'https://github.com/pleaseai/code-style/edit/main/apps/docs/{path}',
  socialImageAlt: 'PleaseAI Code Style documentation preview',
  sidebar: {
    // Content lives under `src/content/docs/<locale>/`, so each locale is a
    // top-level section. Scoping the rail to the active section keeps Korean
    // pages from listing English pages (and vice versa).
    scope: 'section',
  },
})

/** Joins Markdown blocks with blank lines, skipping empty ones. */
function joinBlocks(...blocks: Array<string | boolean | undefined>): string {
  return blocks
    .filter((block): block is string => typeof block === 'string' && block.trim() !== '')
    .map(block => block.trim())
    .join('\n\n')
}

export default defineConfig({
  // nimbus:adapter
  output: 'static',
  // Keep the URLs the Docus site served: `/en/cli` (not `/en/cli/`), emitted
  // as `en/cli.html` so Cloudflare Pages answers the bare path with a 200.
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  // Astro's built-in i18n routing. Every locale is prefixed (`/en/...`,
  // `/ko/...`) and `/` redirects to the default locale, matching the URL
  // scheme of the previous site. Pages are not under `src/pages/[locale]`;
  // the locale is the first segment of each content entry id instead.
  i18n: {
    locales: [...locales],
    defaultLocale,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  // `/` has no content of its own: send readers to the default locale's
  // landing page. Nimbus writes this into `dist/_redirects`, so Cloudflare
  // Pages answers `/` with a 301; Astro's meta-refresh `index.html` is never
  // served.
  redirects: {
    '/': `/${defaultLocale}`,
  },
  // Tailwind v4 via its Vite plugin (the integration Astro recommends for
  // Tailwind v4 — replaces the PostCSS plugin, which doesn't build under
  // Astro 7's Vite 8 bundler).
  vite: {
    plugins: [tailwindcss()],
  },
  // Hover-prefetch link targets so full-page navigations feel instant without
  // a client-side router.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    nimbus(nimbusConfig, {
      // Authoring rules are opt-in by design — your repo, your taste. The
      // two below are the load-bearing pair: frontmatter has to validate
      // against the content schema for the page to render properly, and
      // broken internal links are 404s for your readers. Add the others
      // (heading hierarchy, code-block language, style, etc.) when you're
      // ready to enforce them — see `nimbus-docs lint --help`.
      rules: {
        'nimbus/frontmatter-shape': 'error',
        'nimbus/internal-link': 'error',
      },
      // Wrap wide tables so they scroll instead of overflowing the page
      // (styled by `.nb-table-scroll` in src/styles/prose.css).
      markdown: {
        hastPlugins: [tableScroll()],
        // How the site's own MDX components read in the generated Markdown
        // (per-page `.md`, `llms-full.txt`) that agents consume.
        componentMap: {
          Hero: {
            revision: 'hero-v1',
            render: ({ attrs, children }) => joinBlocks(attrs.description, children),
          },
          Section: {
            revision: 'section-v1',
            render: ({ attrs, children }) => joinBlocks(`## ${attrs.title}`, attrs.description, children),
          },
          LinkButton: {
            revision: 'link-button-v1',
            render: ({ attrs, children }) => `- [${children.trim()}](${attrs.href})`,
          },
          Card: {
            revision: 'card-v1',
            render: ({ attrs, children }) => {
              const title = typeof attrs.href === 'string' ? `[${attrs.title}](${attrs.href})` : attrs.title
              return `- **${title}** — ${children.trim()}`
            },
          },
        },
      },
    }),
  ],
})
