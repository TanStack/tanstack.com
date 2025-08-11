## Refactor plan: consolidate duplicated landing-page patterns

Owner: Web Platform
Status: In Progress
Scope: `src/routes/_libraries/*.$version.index.tsx`, shared components, utils

### Tasks

1. LibraryHero component

- Why: Repeated hero headers across library pages (gradient title, subtitle, description, CTA, optional status badge)
- Deliverable: `src/components/LibraryHero.tsx` + usage docs
- Acceptance: Replace hero blocks in at least 1 page; API flexible for per-library colors/badges
- Progress: Scaffolded component file

2. SponsorsSection component

- Why: Repeated Sponsors section layout (`<Await>` on `sponsorsPromise`, `SponsorPack`, CTA)
- Deliverable: `src/components/SponsorsSection.tsx`
- Acceptance: Drop-in replacement; supports optional CTA toggle and size tuning
- Progress: Scaffolded component file

3. PartnersSection component

- Why: Repeated partners filtering + grid + previous-partners link
- Deliverable: `src/components/PartnersSection.tsx`
- Acceptance: Supports `libraryId` filter; consistent card UX
- Progress: Scaffolded component file

4. BottomCTA component

- Why: Repeated "Wow, you've come a long way!" + button CTA block
- Deliverable: `src/components/BottomCTA.tsx`
- Acceptance: Customizable button label/color; link via router `to`/`params`
- Progress: Scaffolded component file

5. Dark-mode detection hook

- Why: Repeated `isDark` + `matchMedia` effect for embeds
- Deliverable: `src/hooks/useIsDark.ts` using `ThemeProvider`
- Acceptance: Returns boolean dark-mode, SSR-safe
- Progress: Scaffolded hook

6. StackBlitzEmbed component

- Why: Repeated iframe embed construction with theme, sandbox, sizing
- Deliverable: `src/components/StackBlitzEmbed.tsx`
- Acceptance: Props: `repo`, `branch`, `examplePath`, `file?`, `preset?`, `height?`; auto theme
- Progress: Scaffolded component file

7. FeatureGrid component

- Why: Repeated "feature checklist" grids with `FaCheckCircle`
- Deliverable: `src/components/FeatureGrid.tsx`
- Acceptance: Props: `title?`, `items`, `columns?`, `icon?`
- Progress: Scaffolded component file

8. TrustedByMarquee component

- Why: Repeated marquee brand scrollers
- Deliverable: `src/components/TrustedByMarquee.tsx`
- Acceptance: Props: `brands`, `speed?`; CSS animation (no `<marquee>`)
- Progress: Scaffolded component file

9. CTAButton component

- Why: Repeated CTA classnames with color variants
- Deliverable: `src/components/CTAButton.tsx`
- Acceptance: Works with router `Link` (to/params) or `a` (href); consistent styles
- Progress: Scaffolded component file

10. Gradient text helper

- Why: Repeated gradient text class composition per library
- Deliverable: `src/utils/ui.ts` `getGradientText(from, to, extra?)`
- Acceptance: Utility used by `LibraryHero` and pages
- Progress: Scaffolded utility

### Integration plan

- Phase 1: Introduce components and utilities (no page edits)
- Phase 2: Migrate 1–2 library pages as exemplars (eg. Router + Table)
- Phase 3: Roll out across all library pages

### Notes

- Keep APIs minimal and composable; avoid hard-coding library IDs
- Use existing `ThemeProvider` for dark detection
- Respect existing Tailwind style and `twMerge`
