# ADR-0001: Choose Documentation Framework

## Status

Accepted

## Context

`@pleaseai/code-style` monorepo needs a documentation site to describe the usage of its packages (`eslint-config`, `prettier-config`, `editorconfig`). The site will be deployed to **Cloudflare Pages**.

### Constraints

- **Package manager**: Bun (>=1.3.10) with workspace hoisting
- **Module system**: ESM only
- **Deployment**: Cloudflare Pages (static or SSR)
- **Content**: Markdown-based, code examples, package configuration tables

### Problem

An initial attempt with **Docus** (Nuxt-based) failed in the build step. Bun stores dependencies under `node_modules/.bun/` symlinks. Nitro's built-in esbuild Rollup plugin excludes `node_modules/` from TypeScript transformation, but `@rollup/plugin-inject` still processes those files. Since Docus ships raw `.ts` server files (as a Nuxt layer), the inject plugin fails to parse TypeScript syntax. This is a known issue specific to Bun workspace setups.

## Decision

Use **Docus** (Nuxt-based) with docs excluded from Bun workspaces (independent `node_modules`).

The Bun workspace build issue (Nitro's esbuild excludes `node_modules/`, causing `@rollup/plugin-inject` to fail on Docus's raw `.ts` files) is resolved by keeping docs as a standalone project with its own dependency tree. MCP toolkit is disabled (`mcp: { enabled: false }`) to avoid the `agents/mcp` Cloudflare Workers import issue. Content database uses SQLite locally and D1 conditionally via `NUXT_CONTENT_DATABASE_TYPE` env var.

## Options

| Criteria | Docus | VitePress | Starlight | Fumadocs | Nextra |
|---|---|---|---|---|---|
| **Framework** | Nuxt 4 | Vite + Vue | Astro | Next.js | Next.js |
| **CF Pages** | SSR (D1 required) | SSG (official guide) | SSG (official adapter) | SSG (static export) | SSG (static export) |
| **Bun compat** | Broken (inject + .ts) | Excellent | Good | Good | Good |
| **Monorepo** | Poor (Bun symlinks) | Excellent | Good | Good | Good |
| **Setup** | Medium | Low | Low | Medium | Low-Medium |
| **Content** | Markdown + MDC | Markdown + Vue | Markdown + MDX | MDX | MDX |
| **Search** | Built-in | Pagefind / Algolia | Pagefind (built-in) | Orama (built-in) | Flexsearch |
| **i18n** | Plugin | Plugin | 30+ languages | Built-in | Limited |
| **Dark mode** | Yes | Yes | Yes | Yes | Yes |
| **GitHub stars** | ~3k | ~14k | ~7.7k | ~10.9k | ~12k |

### Option 1: VitePress

Vite-based, Vue-powered static site generator optimized for documentation.

**Pros:**
- Simplest setup, lowest overhead
- Official Cloudflare Pages deployment guide
- Excellent Bun and monorepo compatibility
- Largest community (14k stars), battle-tested
- Extremely fast (Vite-based, lightweight output)

**Cons:**
- Vue-centric (this repo is framework-agnostic)
- i18n requires third-party plugin
- Markdown only (no MDX)

### Option 2: Starlight (Astro)

Astro-based documentation framework with batteries included.

**Pros:**
- SSG mode works cleanly on Cloudflare Pages
- Built-in Pagefind search, 30+ language i18n
- Bun + CF Pages verified by community
- Framework-agnostic (fits this repo's nature)
- Accessible typography, good defaults

**Cons:**
- Astro is an additional framework to learn
- Smaller plugin ecosystem than VitePress

### Option 3: Fumadocs

React/Next.js documentation framework with composable architecture.

**Pros:**
- Modern App Router, composable (Content -> Core -> UI)
- Built-in OpenAPI and TypeScript Twoslash
- Active development (10.9k stars)
- MDX support

**Cons:**
- Next.js dependency (heavy for a simple docs site)
- CF Pages requires `@cloudflare/next-on-pages` adapter
- `fumadocs-mdx` uses webpack (not Bun's bundler)

### Option 4: Docus (with workaround)

Keep the Nuxt-based Docus with a custom Rollup plugin to strip TypeScript from `.bun/` paths.

**Pros:**
- Already partially set up
- Rich Nuxt UI components, Nuxt Content integration
- Consistent with `ask` repo's Nuxt ecosystem

**Cons:**
- Requires custom Rollup plugin workaround for Bun
- `defineAppConfig` prerender issue (additional fix needed)
- D1 database required for SSR on Cloudflare
- Fragile — Docus/Nitro updates may break the workaround

### Option 5: Nextra

Next.js documentation framework (MDX-based).

**Pros:**
- Simple setup, mature (12k stars)
- MDX + React components

**Cons:**
- Next.js dependency
- Similar CF Pages adapter concerns as Fumadocs
- Less actively developed than alternatives

## Recommendation

**Starlight** or **VitePress** are the strongest fits for this project:

- **Starlight** if we value built-in i18n, search, and framework-agnostic identity
- **VitePress** if we value simplicity, speed, and the largest community

Both have proven Bun compatibility, clean SSG output for Cloudflare Pages, and minimal setup overhead. Neither requires database integration or custom workarounds.

**Avoid Docus** until the Bun workspace + `rollup-plugin-inject` issue is resolved upstream.

## Consequences

### If Starlight is chosen

- Add `docs/` as Astro project with `@astrojs/starlight`
- Markdown content migrates directly (minor frontmatter adjustments)
- Deploy via `astro build` -> `.output/` to CF Pages

### If VitePress is chosen

- Add `docs/` as VitePress project
- Markdown content migrates directly
- Deploy via `vitepress build` -> `.vitepress/dist/` to CF Pages

### Neutral

- Existing content (5 pages) can be reused with minor format changes regardless of choice
- No impact on existing packages or monorepo build pipeline

## References

- [VitePress on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vitepress-site/)
- [Astro on Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/)
- [Starlight docs](https://starlight.astro.build/)
- [Fumadocs static export](https://fumadocs.dev/docs/ui/static-export)
- [Docus rollup-plugin-inject issue](https://www.answeroverflow.com/m/1434205777073147914)
