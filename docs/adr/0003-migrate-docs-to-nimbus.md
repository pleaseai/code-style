# ADR-0003: Migrate the Documentation Site to Nimbus

## Status

Accepted

Supersedes ADR-0001 and ADR-0002.

## Context

The documentation site (`https://code-style.pages.dev`) ran on **Docus**
(Nuxt 4 + Nuxt Content) from `docs/`, deployed to the Cloudflare Pages project
`pleaseai-code-style`. Keeping it working required a stack of workarounds:

- **Bun linker** — Docus ships raw `.ts` server files that Nitro's
  `rollup-plugin-inject` cannot parse under Bun's isolated linker, so the root
  `bunfig.toml` switched the whole workspace to `linker = "hoisted"`
  (ADR-0001).
- **MCP toolkit** — `@nuxtjs/mcp-toolkit` imports `agents/mcp`, which breaks
  the `cloudflare_pages` Nitro preset, so it had to be disabled.
- **D1 database** — Nuxt Content needed a D1 binding plus `nodejs_compat` and
  `NUXT_*` vars on Cloudflare, for a site whose content never changes at
  runtime.
- **i18n routing** — Docus's `/:lang?` routes collide with `@nuxtjs/i18n`'s
  prefix strategy; an inline Nuxt module rewrote the route table after Docus
  registered it (ADR-0002).

Each workaround depends on framework internals and can break on any Docus,
Nuxt, or Nitro release. The site also serves AI coding assistants
(`/llms.txt`, per-page Markdown), so agent-readable output is a first-class
requirement, not an add-on.

### Constraints

- Keep every live URL: `/` (200), `/en`, `/ko`, `/en/<slug>`, `/ko/<slug>`,
  and `/llms.txt`.
- Keep the existing Cloudflare Pages project and its domain.
- Bun workspace, ESM only, lint with the repository's own ESLint config.
- English and Korean content, with the same pages in both locales.

## Decision

Rebuild the site with **[Nimbus](https://github.com/cloudflare/nimbus)**
(Astro 7 + Tailwind v4) in `apps/docs/`, as static output deployed to the
existing Cloudflare Pages project.

### Why Nimbus

- **Agent-first outputs by default** — `/llms.txt`, `/llms-full.txt`,
  per-section `/<section>/llms.txt`, a Markdown and an MDX version of every
  page, sitemap, `robots.txt`, and OG images, with no extra modules.
- **Owned source** — the scaffolder writes the layouts, components, routes,
  and styles into the repository. Only the plumbing (content schemas, sidebar,
  Markdown generation, build hooks) ships as the `@cloudflare/nimbus-docs`
  package, so site-specific behaviour such as i18n is plain source code
  rather than a patch against framework internals.
- **Static Astro output** — `astro build` writes plain files to
  `apps/docs/dist/`. No database, no server runtime, no compatibility flags.
- **Drops the Docus workarounds** — no Nitro preset, no MCP toolkit, no D1,
  no route-table rewriting.

### i18n wired by hand

Nimbus has no built-in i18n. We wire **Astro's built-in i18n routing** into
the owned source instead of adopting a third-party plugin:

- `astro.config.ts` declares `i18n` with `locales: ['en', 'ko']`,
  `defaultLocale: 'en'`, and `prefixDefaultLocale: true`, so every locale is
  prefixed. `redirects: { '/': '/en' }` makes `/` a meta-refresh page to the
  English landing, as before.
- Content lives in one Nimbus `docs` collection under
  `src/content/docs/<locale>/`, so the locale is the first segment of every
  URL. `sidebar.scope: 'section'` limits the rail (and prev/next) to the
  current locale.
- `src/i18n/` holds the locale list, UI strings, and a helper that maps a
  page to its translations. `BaseLayout.astro` sets `<html lang>` and emits
  `hreflang` alternates (plus `x-default`); `Header.astro` renders a language
  switcher; `[...slug].astro` roots breadcrumbs at the locale landing page.
- Search stays per-locale for free: Pagefind builds one index per
  `<html lang>` and loads the index matching the current page.

### Deployment and versions

- `apps/docs/wrangler.jsonc` targets the existing Pages project with
  `pages_build_output_dir: "dist"`; `bun run docs:deploy` runs
  `wrangler pages deploy`. The D1 binding, `nodejs_compat`, and `NUXT_*` vars
  are gone.
- Static output uses `build.format: 'file'` and `trailingSlash: 'never'`, so
  pages are emitted as `en/cli.html` and Cloudflare Pages answers `/en/cli`
  with a 200, matching the previous URLs.
- Nimbus is pre-1.0 (`0.x`) and can change between minor releases, so every
  dependency of the docs app is pinned to an exact version
  (`@cloudflare/nimbus-docs` `0.17.0`, `astro` `7.3.1`, scaffolded with
  `@cloudflare/create-nimbus-docs` `0.7.11`).

## Options

| Criteria | Nimbus | Starlight | Keep Docus |
| --- | --- | --- | --- |
| **Framework** | Astro 7 | Astro | Nuxt 4 |
| **Output on CF Pages** | Static | Static | SSR + D1 |
| **Bun workspace** | Works | Works | Needs hoisted linker |
| **Agent outputs** | Built in (`llms.txt`, per-page Markdown/MDX) | Plugin | Built in (`llms.txt`, raw Markdown) |
| **UI ownership** | Owned source in the repo | Theme + component overrides | Theme + app config |
| **i18n** | None (wire Astro i18n by hand) | Built in | `@nuxtjs/i18n` + route workaround |
| **Maturity** | Pre-1.0 | Stable | Stable, but fragile here |

### Option 1: Nimbus (chosen)

**Pros:** agent outputs by default; full control of the UI as owned source;
static output with no runtime services; no framework workarounds.

**Cons:** pre-1.0 and fast-moving; no built-in i18n; small community.

### Option 2: Starlight

**Pros:** stable; built-in i18n and search; Astro static output.

**Cons:** agent outputs (`llms.txt`, per-page Markdown) need plugins; UI
changes go through component overrides rather than owned files.

### Option 3: Keep Docus

**Pros:** no migration work.

**Cons:** every workaround in the Context section stays, and each Docus or
Nitro upgrade risks breaking the build or the i18n routes again.

## Consequences

### Positive

- The site is a static build: no D1 database, no Worker runtime, no
  compatibility flags.
- `/llms.txt` is joined by `/llms-full.txt`, `/en/llms.txt`, `/ko/llms.txt`,
  and a Markdown (`/<page>/index.md`) and MDX (`/<page>/index.mdx`) version of
  every page in both locales.
- Layouts and components are ordinary repository source, linted with the
  repository's ESLint config (`astro: true`).
- The Docus-specific gotchas (MCP toolkit, `cloudflare_pages` preset, D1)
  no longer apply.

### Negative

- **i18n is ours to maintain.** Every new page must exist under both
  `src/content/docs/en/` and `src/content/docs/ko/` with the same path, or the
  language switcher and `hreflang` alternates omit it. Nimbus chrome strings
  ("On this page", "Search", "Copy page", ...) stay in English on Korean
  pages unless we localize them in the owned components.
- **Upgrades take review.** Nimbus releases ship as starter-file diffs
  (`nimbus-docs outdated` / `diff`) and migrations (`nimbus-docs migrate`).
  Files we edited for i18n (`BaseLayout.astro`, `Header.astro`,
  `[...slug].astro`) and the reformatted starter files need a manual merge.
  The vendored `src/components/ui/**` primitives and `DocsLayout.astro` are
  kept byte-identical to upstream (and excluded from ESLint) so they can be
  updated with `nimbus-docs diff --apply` or `nimbus-docs add <slug> --overwrite`.
- **Pinned 0.x versions** must be bumped deliberately, reading each package's
  changelog first.

### Neutral

- Page URLs are unchanged. Docus's `/raw/<locale>/<page>.md` Markdown paths
  are replaced by Nimbus's `/<locale>/<page>/index.md`; `/sitemap.xml`
  redirects to `/sitemap-index.xml`.
- `bunfig.toml` keeps `linker = "hoisted"`. It was introduced for Docus and
  may no longer be needed, but removing it changes how every workspace
  package resolves dependencies and has not been verified.

## References

- [Nimbus](https://github.com/cloudflare/nimbus) and [docs](https://nimbus-docs.com)
- [Astro internationalization routing](https://docs.astro.build/en/guides/internationalization/)
- [Pagefind multilingual search](https://pagefind.app/docs/multilingual/)
- ADR-0001: Choose Documentation Framework
- ADR-0002: Workaround for Docus i18n Routing Bug
