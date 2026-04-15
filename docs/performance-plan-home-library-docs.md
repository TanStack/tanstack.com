# Homepage, Library Landing, and Docs Performance Plan

## Goal

Make the homepage, library landing pages, and docs materially faster, lighter, and cheaper to render without regressing content quality or navigation UX.

## Current Baseline

- Homepage route chunk: `dist/client/assets/index-Bq0A5jmY.js` at `564.79 kB / 172.14 kB gzip`
- Shared shell chunk: `dist/client/assets/app-shell-BikUtTEO.js` at `349.55 kB / 110.08 kB gzip`
- Search modal chunk: `dist/client/assets/SearchModal-Bl-tUxqr.js` at `195.54 kB / 54.27 kB gzip`
- Docs shell chunk: `dist/client/assets/DocsLayout-Bga1-HA9.js` at `17.61 kB / 6.05 kB gzip`
- Markdown chrome chunk: `dist/client/assets/MarkdownContent-ia2V1dk8.js` at `19.37 kB / 6.39 kB gzip`
- Global CSS: `dist/client/assets/app-CBMELhsb.css` at `319.24 kB / 40.48 kB gzip`

## Main Problems

- Homepage ships too much in one route chunk.
- Library landing pages pay docs-shell and docs-config cost before the user asks for docs.
- Docs still do too much work per request even with GitHub content caching.
- Hidden docs UI still mounts and runs effects/queries.
- Anonymous docs users still trigger auth-related client queries for framework preference.
- Some "lazy" controls are effectively eager.

## Success Targets

- Cut the homepage route chunk hard enough that it is no longer one of the top client payloads.
- Remove docs-config and docs-layout from the critical path for landing pages.
- Turn docs page rendering into mostly cached work.
- Avoid client queries on first paint for content that can be rendered server-side.
- Reduce hidden-work JS on docs mobile and desktop layouts.

## Workstreams

### 1. Homepage route diet

Targets:

- `src/routes/index.tsx`
- `src/components/OpenSourceStats.tsx`
- `src/components/ShowcaseSection.tsx`
- `src/components/PartnersGrid.tsx`
- `src/components/MaintainerCard.tsx`

Changes:

- Break below-the-fold homepage sections into viewport-triggered lazy boundaries.
- Move recent posts off client `useQuery` and into route loader or server-rendered data.
- Stop client-fetching OSS stats on initial paint. Render a server snapshot first.
- Keep `DeferredApplicationStarter` deferred by visibility or interaction, not just idle timeout.
- Avoid eagerly importing large static datasets into the first route chunk where possible.
- Stop rendering both light and dark hero image variants eagerly.

Expected win:

- Lower homepage JS, lower hydration cost, lower first-load network.

### 2. Dedicated library landing shell

Targets:

- `src/routes/-library-landing.tsx`
- `src/components/DocsLayout.tsx`
- landing components under `src/components/landing/`

Changes:

- Introduce a dedicated `LibraryLandingLayout`.
- Remove `DocsLayout` from landing pages.
- Stop fetching docs `config.json` in the landing-page critical path unless a landing section actually needs it.
- Keep framework/version/docs navigation lightweight on landing pages and hand off to docs only when needed.

Expected win:

- Better landing-page TTFB, less landing-page JS, less docs chrome on non-docs surfaces.

### 3. Docs render caching

Targets:

- `src/utils/docs.functions.ts`
- `src/utils/github-content-cache.server.ts`
- `src/utils/markdown/renderRsc.tsx`
- `src/utils/markdown/processor.rsc.tsx`
- `src/components/markdown/renderCodeBlock.server.tsx`

Changes:

- Cache rendered docs artifacts, not just raw GitHub files.
- Persist `title`, `description`, `headings`, and rendered output keyed by repo, ref, docs root, and path.
- Reuse existing docs artifact cache infra instead of adding a second caching path.
- Make docs requests mostly cache hits unless the source changed.

Expected win:

- Better docs TTFB, less server CPU, fewer repeated markdown and Shiki passes.

### 4. Docs layout mount discipline

Targets:

- `src/components/DocsLayout.tsx`
- `src/components/RightRail.tsx`
- `src/components/RecentPostsWidget.tsx`

Changes:

- Do not mount mobile docs menu on desktop.
- Do not mount desktop docs menu on mobile.
- Do not mount right rail when hidden by breakpoint.
- Gate animated partner strip work by actual viewport and reduced-motion preference.
- Ensure hidden rails do not issue queries or observers.

Expected win:

- Lower docs runtime cost, especially on mobile.

### 5. Remove anonymous auth work from docs and landing

Targets:

- `src/components/FrameworkSelect.tsx`
- `src/hooks/useCurrentUser.ts`
- `src/components/SearchModal.tsx`
- `src/components/NavbarAuthControls.tsx`

Changes:

- Make framework preference local-first for anonymous users.
- Only sync framework preference to server when user state is already known.
- Avoid triggering `getCurrentUser` on docs and landing pages just to resolve a preference.
- Audit other shell components for accidental auth fetches during anonymous browsing.

Expected win:

- Fewer unnecessary client requests, cleaner anonymous docs navigation.

### 6. Shared shell cleanup

Targets:

- `src/routes/__root.tsx`
- `src/router.tsx`
- `src/components/Navbar.tsx`
- `src/components/markdown/MarkdownContent.tsx`

Changes:

- Verify why some intended dynamic imports are not splitting effectively.
- Trim eager shell work around Sentry boot where possible.
- Fix `MarkdownContent` so `CopyPageDropdown` only loads on real interaction.
- Review navbar asset duplication and avoid eager light/dark image duplication where possible.

Expected win:

- Smaller app shell, less global cost paid by every route.

## Suggested Implementation Order

1. Fix obviously accidental eager work.
2. Make docs layout mount only what is visible.
3. Remove anonymous auth fetches from docs and landing flows.
4. Add dedicated library landing shell and remove docs-config from landing critical path.
5. Move homepage content and stats to server-first data flows and split below-the-fold sections.
6. Add rendered docs artifact caching.
7. Rebuild and compare chunks, request timings, and interaction cost.

## PR Breakdown

### PR 1

- Fix `MarkdownContent` eager copy-dropdown load
- Stop hidden docs rails and menus from mounting
- Gate mobile partner strip animation correctly

### PR 2

- Remove anonymous auth fetches from framework selection and related docs shell code

### PR 3

- Add `LibraryLandingLayout`
- Remove `DocsLayout` and docs config dependency from landing critical path

### PR 4

- Split homepage below the fold
- Server-render recent posts and stats
- Tighten app-starter deferral

### PR 5

- Cache rendered docs artifacts
- Measure docs TTFB and server CPU improvement

### PR 6

- Shared shell follow-up: Sentry boot, navbar assets, remaining bundle outliers

## Verification

- Run `pnpm build` after each major phase.
- Track homepage, a representative library landing page, and a representative docs page.
- Compare:
- route chunk size
- app shell size
- docs TTFB
- number of client requests on first load
- whether anonymous docs visits trigger user/auth requests
- smoke-check desktop and mobile docs navigation

## Notes

- `LazyLandingCommunitySection` and `LazySponsorSection` already use the right pattern. Reuse that pattern more aggressively.
- `StackBlitzEmbed` is already `loading="lazy"`, but a poster-plus-click model may still be worth it for landing pages.
- Do not spend time micro-optimizing heading observers or tiny docs chunks before fixing the homepage and landing-page architecture.
