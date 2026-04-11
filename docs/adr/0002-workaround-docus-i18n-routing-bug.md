# ADR-0002: Workaround for Docus i18n Routing Bug

## Status

Accepted — workaround applied in `docs/nuxt.config.ts` pending an upstream fix.

## Context

After adding `@nuxtjs/i18n` with `en` + `ko` locales to the Docus-powered
`docs/` site (commit `0c3cf38`), the deployed site exhibited two broken
behaviours:

1. **`https://code-style.pages.dev/ko/cli` rendered the Korean landing page**
   (the content of `content/ko/index.md`) instead of the Korean CLI docs
   (`content/ko/4.cli.md`). The `<title>` was `PleaseAI Code Style - PleaseAI
   Code Style` and the body contained the hero section, not the CLI
   reference.
2. **`/en/cli`, `/en/eslint-config`, etc. returned 404**, and no English
   sub-pages were prerendered to `dist/en/`.

Both symptoms surface only under specific conditions that align with this
project's content structure. They do not reproduce on `docus.dev` itself.

This ADR records the root cause, why `docus.dev` is unaffected, and the
workaround that keeps the site correct until Docus ships a fix.

## Investigation

### Timeline of the upstream regression

| Docus version | Date        | Relevant change                                                                 |
| ------------- | ----------- | ------------------------------------------------------------------------------- |
| pre-v5.0.0    | —           | `layer/app/pages/[[lang]]/index.vue` — file-based landing page                  |
| **v5.0.0**    | 2025-09-24  | Commit [`d97a793`](https://github.com/nuxt-content/docus/commit/d97a793) renamed `[[lang]]/index.vue` → `templates/landing.vue` and introduced `layer/modules/routing.ts` which pushes `lang-index` at path `/:lang?` programmatically |
| v5.6.0        | 2026-02-17  | [PR #1274](https://github.com/nuxt-content/docus/pull/1274) wraps the push in a `landingPageExists()` check but leaves the `/:lang?` path unchanged |
| v5.9.0        | 2026-04-02  | Current installed version — bug still present                                   |

Before v5.0.0, the landing page lived as a real file at
`pages/[[lang]]/index.vue`, which `@nuxtjs/i18n` could rewrite cleanly per
locale. After v5.0.0, the route is pushed manually at `/:lang?`, and the
optional `:lang?` parameter is the source of the bug.

### Two interacting bugs

**Bug 1 — `lang-index` route path (`/:lang?`).**
Docus forces `@nuxtjs/i18n` to `strategy: 'prefix'` in
`layer/modules/config.ts`, so every page path is duplicated per locale. The
`lang-index` route becomes `/en/:lang?` and `/ko/:lang?`. The same happens
to the file-based `[[lang]]/[...slug].vue` page, which becomes
`/en/:lang?/:slug(.*)*` and `/ko/:lang?/:slug(.*)*` — the `:lang?` is
redundant because i18n has already injected the locale.

For a 2-segment URL like `/ko/cli`:

- `/ko/:lang?` matches with `lang='cli'` (the greedy optional)
- `/ko/:lang?/:slug(.*)*` matches with `lang='cli'`, `slug=''`

Vue Router's scoring picks the shorter (more specific) `/ko/:lang?` route,
which resolves to the `landing.vue` component. Without Bug 2, the landing
template's `.path('/ko/cli').first()` query would return `null` and a clean
`createError({ statusCode: 404 })` would be thrown. Bug 2 is what turns
this into a silent render of the wrong page.

**Bug 2 — `landing.vue` uses a static `useAsyncData` key.**
`node_modules/docus/app/templates/landing.vue`:

```ts
const collectionName = computed(() =>
  isEnabled.value ? `landing_${locale.value}` : 'landing'
)

const { data: page } = await useAsyncData(
  collectionName.value,                            // ← static key: "landing_ko"
  () => queryCollection(collectionName.value).path(route.path).first(),
)
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
```

Compare with the sibling `[[lang]]/[...slug].vue`, which correctly uses a
route-scoped key:

```ts
useAsyncData(
  kebabCase(route.path),                           // ← per-route key
  () => queryCollection(collectionName.value).path(route.path).first(),
)
```

Nuxt 4 + Nitro prerender renders all URLs in a single server process, and
`useAsyncData` payloads are keyed globally. The first URL whose landing
query succeeds (`/ko` → finds `landing_ko[/ko]`) populates the `landing_ko`
payload. Every subsequent URL that also dispatches to `landing.vue`
(e.g. `/ko/cli` via Bug 1) short-circuits on the cached payload: the
async factory never runs, so the `.path('/ko/cli')` lookup never happens
and the stale Korean landing data is returned. The 404 branch is never
reached.

This was verified empirically by temporarily disabling the workaround and
diffing the generated `_payload.json` files:

```
dist/ko/_payload.json       ... "landing_ko": <ref 46>
dist/ko/cli/_payload.json   ... "landing_ko": <ref 46>   ← same reference
```

Both payloads point to the exact same `landing_ko` object — conclusive
evidence of cross-route cache bleed.

### Why docus.dev is not affected

The content layout for `docs.dev` puts every document in a sub-directory
and never places an `index.md` inside those sub-directories:

```
docs/content/en/
├── 1.getting-started/
│   ├── 2.introduction.md
│   ├── 3.installation.md
│   └── …
├── 2.concepts/
│   └── 1.edition.md          # no index.md → no /en/concepts page
├── 3.essentials/
│   └── 1.markdown-syntax.md  # no index.md → no /en/essentials page
└── index.md                   # the only 1-segment locale page
```

All docs live at 3-or-more segments (`/en/concepts/edition`,
`/en/essentials/markdown-syntax`, …). The affected URL surface — content
whose path is exactly `/LOCALE/X` — is empty, so the routing collision
never surfaces. Probing `docus.dev` confirms this:

| URL | Status | Notes |
| --- | --- | --- |
| `/en/concepts/edition` (3 seg) | 200 ✓ | Renders correctly (via `[[lang]]/[...slug]`) |
| `/en/concepts` (2 seg) | 404 | No `content/en/2.concepts/index.md` |
| `/en/introduction` (2 seg) | 404 | No matching file |

This project's `content/ko/` has files at exactly the affected 2-segment
boundary:

| Content file | URL | Affected? |
| --- | --- | --- |
| `content/ko/index.md` | `/ko` | No (1 segment — handled by design) |
| `content/ko/4.cli.md` | `/ko/cli` | **Yes** |
| `content/ko/2.prettier-config.md` | `/ko/prettier-config` | **Yes** |
| `content/ko/3.editorconfig.md` | `/ko/editorconfig` | **Yes** |
| `content/ko/1.eslint-config/1.index.md` | `/ko/eslint-config` | **Yes** (sub-dir `index.md` also maps to 2 segments) |
| `content/ko/1.eslint-config/5.advanced.md` | `/ko/eslint-config/advanced` | No (3 segments) |

### Secondary issue — unprefixed landing links

In addition to the routing bug, `docs/content/en/index.md` used
unprefixed `to: /cli`, `to: /eslint-config`, … links in its hero buttons
and page cards. With `strategy: 'prefix'` every route is locale-prefixed,
so those hrefs 404 at runtime and — more visibly — the prerender crawler
never discovers `dist/en/cli`, `dist/en/eslint-config`, etc. This is an
ordinary content mistake, not a Docus bug, but it compounded the
symptoms and was fixed alongside the workaround. (Inline markdown links
within `docs/content/en/1.eslint-config/**` still use unprefixed paths
and are tracked as a follow-up.)

## Decision

Apply a local `pages:extend` workaround in `docs/nuxt.config.ts` that
strips the redundant `:lang?` segment from both Docus-pushed routes,
registered as an **inline Nuxt module** so the callback runs after
Docus's routing module:

```ts
modules: [
  '@nuxtjs/i18n',
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
]
```

Why an inline module instead of `nuxt.config.ts → hooks['pages:extend']`:
config-level hooks register during config loading, *before* any module
setup runs. Docus pushes its pages during `modules/routing.ts` setup, so
a config-level hook would execute before those pages exist and find
nothing to modify. An inline module listed after `@nuxtjs/i18n` is set up
after Docus's modules (which come from the `extends: ['docus']` layer),
so its `pages:extend` callback runs last and sees the final page list.

After the rewrite, `@nuxtjs/i18n` prefixes the cleaned paths per locale
and produces a conflict-free route table:

| Route name | Path |
| --- | --- |
| `lang-index` | `/` |
| `lang-index___en` | `/en` |
| `lang-index___ko` | `/ko` |
| `lang-slug___en` | `/en/:slug(.*)*` |
| `lang-slug___ko` | `/ko/:slug(.*)*` |

The landing route matches only the locale root, and the slug route
handles all sub-pages. Bug 1 is eliminated.

Bug 2 (the static `useAsyncData` key in `landing.vue`) is **not touched
locally** — Docus's template file lives in `node_modules/` and patching
it is not viable. Because Bug 1 is fixed, Bug 2 becomes unreachable in
practice: the only URLs that dispatch to `landing.vue` are `/en` and
`/ko`, and each runs its own query for its own `route.path`, so there is
no cache collision. Bug 2 remains a latent issue worth fixing upstream.

Finally, unprefixed `to:` attributes in `docs/content/en/index.md` are
changed to `/en/cli`, `/en/eslint-config`, etc. so the prerender crawler
discovers English sub-pages.

## Verification

Clean rebuild after applying the workaround:

```
[nitro] ℹ Prerendering 7 initial routes with crawler
[nitro] ℹ Prerendered 86 routes in 14.071 seconds
```

Before: 5 routes prerendered, `dist/ko/cli.html` titled `PleaseAI Code
Style - PleaseAI Code Style` with hero content.
After: 86 routes prerendered, `dist/ko/cli.html` titled `CLI - PleaseAI
Code Style` with the correct CLI reference body, `dist/en/cli.html` and
all nested `dist/{en,ko}/eslint-config/{advanced,editor,frameworks,nuxt,package-json}.html`
generated.

## Consequences

### Positive

- `https://code-style.pages.dev/{en,ko}/*` routes resolve to the correct
  content after deploy.
- Full English and Korean page sets are prerendered (86 routes, up from 5).
- The fix is localised to `docs/nuxt.config.ts` and `docs/content/en/index.md`
  with no changes to `node_modules/`.

### Negative

- `docs/nuxt.config.ts` now carries a ~15-line workaround that depends on
  Docus internal route names (`lang-index`) and exact path strings
  (`/:lang?`, `/:lang?/:slug(.*)*`). A future Docus release that renames
  or restructures these routes will silently break the workaround without
  errors, falling back to the broken behaviour. The workaround includes
  a comment pointing at this ADR so it can be re-evaluated when upgrading.

### Follow-ups

- [ ] File an upstream issue at `nuxt-content/docus` covering Bug 1 and
      Bug 2 with this ADR's reproduction. Preferred fix upstream: restore
      file-based `[[lang]]/index.vue` (pre-v5.0.0 shape) and simplify
      `[[lang]]/[...slug].vue` to `[...slug].vue`, eliminating both the
      redundant `:lang?` and the static useAsyncData key.
- [ ] Remove the workaround once upstream ships a fix. Pin `docus` to a
      known-good version in `docs/package.json` instead of `"latest"` to
      prevent silent regressions.
- [ ] Fix remaining unprefixed inline markdown links in
      `docs/content/en/1.eslint-config/**` (`](/eslint-config/frameworks)`,
      etc.). Korean content is already clean.

## References

- [Docus commit `d97a793` — fix(routing): handle unique root level content](https://github.com/nuxt-content/docus/commit/d97a793)
- [Docus PR #1274 — feat(landing): make it optional](https://github.com/nuxt-content/docus/pull/1274)
- [Docus PR #1275 — feat(layer): handle docs prefix & folder](https://github.com/nuxt-content/docus/pull/1275)
- [@nuxtjs/i18n — Routing strategies](https://i18n.nuxtjs.org/docs/guide/routing-strategies)
- [Nuxt — `pages:extend` hook](https://nuxt.com/docs/api/advanced/hooks)
- [`@nuxt/content` — `queryCollection().path()` uses exact SQL equality](../../node_modules/@nuxt/content/dist/runtime/internal/query.js)
