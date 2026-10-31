# Partner Rail — sizing rules

How partner logos are sized in the tiered rail. Workshop it live at
`/ds/partner-rail`.

## The model

`rendered size = contain(tier box) × per-logo scale`

Two independent layers:

1. **Tier box** — the size budget for a tier. Gold is the source of truth;
   silver and bronze derive from it.
2. **Per-logo `scale`** — a global optical-weight multiplier per partner, so
   logos of different shapes read at a consistent size.

## Layer 1 — tiers (gold is the only knob)

Defined in [`PartnerTierLogo.tsx`](./PartnerTierLogo.tsx):

```ts
PARTNER_LOGO_TIER_STEP = 0.75
PARTNER_LOGO_GOLD = { maxWidth, maxHeight } // px — the source of truth
```

- `gold   = PARTNER_LOGO_GOLD`
- `silver = gold × 0.75`
- `bronze = gold × 0.75²` (0.5625)

Both dimensions scale by the same factor, so any given logo is exactly one step
(×0.75) smaller than the tier above it.

- **To resize the whole rail, change `PARTNER_LOGO_GOLD` only.**
- **Never hand-set silver/bronze** — that reintroduces the inversion this rubric
  fixes.

## Layer 2 — per-logo `scale` (optical weight)

A `transform: scale()` on the logo, set per partner in
[`src/utils/partners.tsx`](../../../utils/partners.tsx) as `image.scale`. It is
**global** — it affects every placement (partners page, heroes, docs rail), not
just this rail. Default is `1.0` (unset).

- `< 1` for logos that read **heavy / too large**: dense or solid marks,
  monograms, icon-forward lockups (e.g. Unkey 0.7, Clerk 0.72, Strapi 0.8).
- `> 1` for logos that read **light / too small**: thin wordmarks, SVGs with
  internal padding, wordmarks that are short for their width (e.g. Netlify 1.25,
  OpenRouter 1.25, PowerSync 1.2, AG Grid 1.1).
- Keep values roughly in `0.7–1.3`. Calibrate at one tier against a reference
  logo, then spot-check the partners page since `scale` is global.

## Adding / changing a partner

1. Set the partner's `tier` in `partners.tsx`.
2. Leave `scale` unset to start.
3. Open `/ds/partner-rail`, and nudge its scale slider until it matches its
   peers. Copy the value from the config output into `image.scale`.

## Layout vs size

These are **layout** knobs (in `PartnerRail.tsx`), separate from logo size:
`rowHeight`, `perRow` (bronze is two-up), `idleOpacity` (lower tiers rest more
muted, lift to color on rail hover).

## Don'ts

- **No per-placement height hacks.** There used to be a Netlify-only
  `max-h-[31px]` override in the rail; it's gone. If a logo reads wrong, fix it
  with its global `scale`, not a one-off in a placement.
