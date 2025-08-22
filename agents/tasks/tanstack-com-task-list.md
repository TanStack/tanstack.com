## TanStack.com Task Tracker

- Updated: 2025-08-14
- Scope: Marketing/brand site tasks that signal growth, leadership, and commercial readiness without deep implementation in this file.
- Convention:
  - Status: Backlog | In Progress | Blocked | Done | Partial
  - Owners: GitHub handles or team names
  - Links: PRs, issues, routes, components

### How to use this file

- Update status/notes as tasks progress. Keep routes/components and data sources referenced so any agent can continue seamlessly.
- Prefer reusing existing components and content models referenced below.

---

## 1. Metrics & Market Leadership Signals

**Goal:** Visible proof of dominance and growth.

### Audit snapshot

- Homepage metrics: `OpenSourceStats` counters present on homepage (`src/routes/_libraries/index.tsx` uses `OpenSourceStats`). Partial.
- "Trusted By": Component exists as text marquee (`src/components/TrustedByMarquee.tsx`). Not on homepage yet; currently used on some library pages (e.g. `src/routes/_libraries/table.$version.index.tsx`). Partial.
- NPM stats: Extensive interactive page exists at `src/routes/stats/npm/index.tsx` with charts and comparisons. Done (separate page).
- Backend metrics: `convex/stats.ts` + `@erquhart/convex-oss-stats` provides GitHub/NPM org metrics; `OpenSourceStats.tsx` consumes `api.stats.getGithubOwner`, `api.stats.getNpmOrg`. Done for aggregate; per-library not yet surfaced.

### Tasks

- [ ] Implement “Trusted By” on homepage

  - Status: Backlog
  - Notes:
    - Reuse `TrustedByMarquee` but upgrade to support logos + links + tooltip proof.
    - Create a central data source `src/data/trustedBy.ts` (or `content/trusted-by.json`) with: `{ id, name, logoLight, logoDark, link, proofUrl, proofType }`.
    - Only include publicly confirmed adopters; store proof URLs (tweets, case studies, repos).
    - Add hover tooltips with proof text and click-through to proof.
    - Placement: in `src/routes/_libraries/index.tsx`, below the hero and above library grid.
  - Acceptance:
    - Renders without CLS, loops smoothly, accessible (ARIA, alt text). Logos swap dark/light.
    - All entries have a proof link; no unverified brands.
  - Links: `src/components/TrustedByMarquee.tsx`, `src/routes/_libraries/index.tsx`.
  - Owner:

- [ ] Add Real-Time Metrics Counters (per-library + org rollup)

  - Status: Partial (org rollup live via `OpenSourceStats`)
  - Notes:
    - Extend counters to per-library pages using existing Convex endpoints or add repo-level endpoints via `convex-oss-stats` if needed.
    - Display: npm weekly/monthly downloads and GitHub stars per library.
    - Consider compact display component `components/MetricsBadge.tsx` (new) for reuse.
    - Performance: hydrate safely (avoid locale formatting mismatch noted in `OpenSourceStats.tsx`).
  - Acceptance:
    - Per-library counters render on each library landing page (e.g., `query.$version.index.tsx`, etc.).
    - Numbers update without layout shift; links to npm and GitHub.
  - Links: `src/components/OpenSourceStats.tsx`, `convex/stats.ts`, library routes under `src/routes/_libraries/*.$version.index.tsx`.
  - Owner:

- [ ] Create “State of TanStack” page
  - Status: Backlog
  - Notes:
    - Route: `src/routes/state-of-tanstack.tsx`.
    - Include growth charts (npm downloads: reuse `NpmStatsChart.tsx` or embed portions of `stats/npm`), GitHub stars, contributors, dependents (available via Convex aggregation already powering `OpenSourceStats`).
      - Community stats: Discord members (needs server function), newsletter subscribers (manual or vendor API), X/Twitter followers (manual or API), repository contributors (Convex or GitHub GraphQL on server).
    - Ecosystem counts: partners (derive from `src/utils/partners.tsx`), plugins/tools (manual list or content collection).
    - CTA to GitHub org.
  - Acceptance:
    - Page loads instantly with cached metrics; charts are responsive and accessible.
    - Sources and last-updated timestamps shown.
  - Links: `src/components/NpmStatsChart.tsx`, `src/components/OpenSourceStats.tsx`, `src/routes/stats/npm/index.tsx`, `src/utils/partners.tsx`.
  - Owner:

### Tech/context

- Data: `@erquhart/convex-oss-stats` via `convex/stats.ts` (org-level GitHub star/contributor/dependent counts, npm downloads). Consider adding per-repo endpoints if needed.
- Secrets: Configure any tokens via Netlify/Convex env; never expose client-side.
- Accessibility: Ensure counters/animations are readable and respect `prefers-reduced-motion`.

---

## 2. Founder & Team Story

**Goal:** Frame the team as visionary and credible.

### Audit snapshot

- Ethos page exists: `src/routes/_libraries/ethos.tsx` (narrative and positioning).
- Maintainers directory page exists: `src/routes/_libraries/maintainers.tsx` with `MaintainerCard` variants and filters; bios sourced from `src/libraries/maintainers`.
- No dedicated "About" route; no speaking engagements index; no curated endorsements/tweets.

### Tasks

- [ ] Redesign/Create “About” page

  - Status: Backlog
  - Notes:
    - Route: `src/routes/about.tsx`.
    - Include founder bio (photo, key achievements, notable talks), milestones timeline, and key contributor mini-bios (reuse `MaintainerCard` in compact mode).
    - Timeline: create `src/data/milestones.ts` (date, title, link, type: release/adoption/partnership).
  - Acceptance: Page showcases founder, timeline, top contributors; links to `maintainers` page.
  - Links: `src/components/MaintainerCard.tsx`, `src/routes/_libraries/maintainers.tsx`.

- [ ] Speaking Engagements section

  - Status: Backlog
  - Notes:
    - Add to About or standalone `src/routes/speaking.tsx`.
    - Data: `src/data/talks.ts` with title, event, date, videoUrl, slidesUrl, tags.
    - Embed YouTube/Vimeo or slides (oEmbed).
  - Acceptance: Grid/list of talks with playable embeds and links.

- [ ] Highlight Industry Influence (quotes + tweets)
  - Status: Backlog
  - Notes:
    - Quotes: `src/data/endorsements.ts` with person, title, quote, avatar, link.
    - Tweets: a curated list using embed script by URL to avoid API complexity; if API required, add server function with token.
    - Component: `components/Endorsements.tsx` and `components/TweetsWall.tsx` (new).
  - Acceptance: Renders endorsements with attribution and embedded tweets with proper theming.

### Tech/context

- Reuse `MaintainerCard` and existing images in `src/images/`.
- Avoid fetching social embeds at build if rate-limited; hydrate on client or cache server-side.

---

## 4. Commercial Hooks

**Goal:** Show monetizable pathways.

### Audit snapshot

- Enterprise/Support: `src/routes/_libraries/paid-support.tsx` exists with HubSpot script and CTAs. Partial substitute for "Enterprise" page.
- No dedicated Partner Program page.

### Tasks

- [ ] “Enterprise” page

  - Status: Partial
  - Notes:
    - Option 1: Rename and expand `paid-support` into `enterprise` (route alias + updated copy) while keeping legacy route.
    - Content: packages, priority support, consulting, integration assistance; lead capture form (HubSpot already wired via `useScript`).
  - Acceptance: Clear tiers/benefits, contact CTA, form submission tracked.
  - Links: `src/routes/_libraries/paid-support.tsx`.

- [ ] Partner Program page
  - Status: Backlog
  - Notes:
    - Route: `src/routes/partners-program.tsx`.
    - Tiers: Integration Partner, Strategic Partner; benefits: co-marketing, spotlight, early access.
    - Link to Partners page.
  - Acceptance: Published page with clear application CTA.

---

## 5. Future Vision Page

**Goal:** Show long-term upside.

### Audit snapshot

- No public roadmap found; ethos narrative exists but not a vision statement page.

### Tasks

- [ ] Public Roadmap page

  - Status: Backlog
  - Notes:
    - Route: `src/routes/roadmap.tsx`.
    - Source: GitHub Projects (read-only) or Notion API (curated). Avoid sensitive IP; create server fetch with caching.
    - Columns: Now, Next, Future.
  - Acceptance: Roadmap renders from source with manual override fallback.

- [ ] Vision Statement page
  - Status: Backlog
  - Notes:
    - Route: `src/routes/vision.tsx`.
    - Narrative: “The Future of Web Tooling”; diagrams showing TanStack as connective tissue.
    - Assets: add diagrams to `public/vision/*` or `media/`.
  - Acceptance: Page published with visuals and links to roadmap.

---

## 6. Media & Momentum

**Goal:** Make hype and credibility easy to digest.

### Audit snapshot

- No dedicated media kit, in-the-news, or social proof feeds found.

### Tasks

- [ ] Press/Media Kit page

  - Status: Backlog
  - Notes:
    - Route: `src/routes/media-kit.tsx`.
    - Include logo assets (light/dark SVG/PNG), founder bio, product screenshots, downloadable one-pager PDF/zip.
    - Store assets under `public/brand/*` or `media/` and provide usage guidelines.
  - Acceptance: Page provides direct downloads and usage rules.

- [ ] In the News page

  - Status: Backlog
  - Notes:
    - Route: `src/routes/news.tsx`.
    - Data: `src/data/news.ts` with `{ year, outlet, title, url, logo }`.
    - Group by year with outlet logos.
  - Acceptance: List renders with working links; new items easy to add.

- [ ] Social Proof section
  - Status: Backlog
  - Notes:
    - Component: `components/SocialProof.tsx` (new) consuming curated data `src/data/social-proof.ts` (tweets, GH discussions, testimonials).
    - Tweets: prefer embed by URL; if API needed, add server function and cache.
  - Acceptance: Mixed feed renders, accessible, themable.

---

### Shared implementation notes

- Routing: New pages should be added under `src/routes/*` using TanStack Start conventions; update nav/footers as needed.
- Data placement: Prefer `src/data/*.ts` (typed) or `content/*.(json|yaml)` for editorial lists. Avoid hardcoding in components unless small.
- Theming: Provide dark/light logo variants; `public/` is ideal for static assets.
- Performance: Use suspense-friendly server fetches and cache. Respect `prefers-reduced-motion` for marquees/counters.
- Accessibility: Alt text for logos, focus states for carousels, keyboard operability.
- SEO: Use `utils/seo` to set titles/descriptions on new routes.
- Analytics: Add outbound link tracking if available (future).

### Potential blockers

- External API limits (GitHub GraphQL, Discord member count, X/Twitter API). Prefer server-side fetch with caching or public embed widgets.
- Legal/branding approvals for “Trusted By” logos—require proof links.

### Quick links to relevant code

- Homepage: `src/routes/_libraries/index.tsx`
- Metrics: `src/components/OpenSourceStats.tsx`, `convex/stats.ts`, `src/components/NpmStatsChart.tsx`, `src/routes/stats/npm/index.tsx`
- Trusted By: `src/components/TrustedByMarquee.tsx`
- Team/Ethos: `src/routes/_libraries/ethos.tsx`, `src/routes/_libraries/maintainers.tsx`, `src/components/MaintainerCard.tsx`
- SEO helper: `src/utils/seo`

### Ownership & tracking

- For each task above, fill in:
  - Owner:
  - Issue/PR links:
  - Status:
  - Next step:
