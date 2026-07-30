# README header images

`GET /api/readme/<libraryId>.png` renders the banner that goes at the top of a
library repo's README, replacing the hand-made PNGs previously committed to
`media/header_*.png` in each repo. It uses the same takumi renderer, brand
assets and per-category accent colors as the site's OG cards, so a branding
change ships to every README at once.

Output is 1800×450 (4:1). At GitHub's ~896px README content width that renders
at 2x and takes up ~224px of height, leaving the badges and intro above the
fold.

## Usage

```html
<img
  src="https://tanstack.com/api/readme/query.png"
  alt="TanStack Query"
  width="900"
/>
```

For a package README inside a multi-framework repo (e.g.
`packages/react-start/README.md`), add `?framework=`:

```html
<img
  src="https://tanstack.com/api/readme/start.png?framework=react"
  alt="TanStack React Start"
  width="900"
/>
```

The framework label is inserted after the `TanStack` prefix:
`start` + `react` → **TanStack React Start**.

## Parameters

| Param       | Required | Behavior                                                                                                                |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| path splat  | yes      | Library id (`query`, `router`, `start`, …). Unknown id → `404`.                                                         |
| `framework` | no       | Must be one of the library's supported frameworks. Anything else → `400` listing the accepted values.                   |
| `title`     | no       | Replaces the rendered name entirely. Clamped to 80 chars. Takes precedence over `framework`, which is then not applied. |
| `subtitle`  | no       | Replaces the tagline. Clamped to 160 chars.                                                                             |

An invalid `framework` is rejected rather than ignored, so a typo in a README
shows up as a broken image during review instead of a banner naming the wrong
package.

## Caching

The endpoint sends `max-age=3600` plus a 24h Cloudflare CDN TTL with
`stale-while-revalidate`. GitHub additionally proxies README images through
camo, which caches on its own schedule — expect a banner change to take a while
to appear on GitHub even after the endpoint updates. That is fine for branding
assets; don't use this endpoint for anything time-sensitive.

## Previewing changes locally

```sh
pnpm run readme:preview
```

Renders every library's header — plus one per supported framework — to
`.readme-preview/`, along with an `index.html` gallery that displays them at
GitHub's 900px render width. Open `.readme-preview/index.html` to check that no
long name or tagline overflows. Run this after touching
`src/server/og/readme-template.tsx`.

(`scripts/og-preview.ts` is the equivalent for the 1200×630 social cards.)

## Implementation

| File                                 | Role                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `src/routes/api/readme/{$}[.]png.ts` | Route handler: param parsing, validation, cache headers          |
| `src/server/og/generate.server.ts`   | `generateReadmeHeaderResponse` + the render path shared with OG  |
| `src/server/og/readme-template.tsx`  | The 1800×450 layout                                              |
| `src/server/og/assets.server.ts`     | Loads fonts and the raster brand emblem                          |
| `scripts/generate-brand-assets.mjs`  | Generates `public/images/brand/tanstack-emblem-charcoal-256.png` |
| `scripts/readme-header-preview.ts`   | Local render + gallery for reviewing layout changes              |
