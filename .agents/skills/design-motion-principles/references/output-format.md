# Output Format

The audit produces one of two outputs:

- **HTML mode (default)** — a self-contained `.html` file written to the audited project's `motion-audits/` directory and opened in the user's default browser. Each Critical or Important finding gets a live, looping CSS demo card beside it.
- **Terminal mode (flag-triggered)** — a decorated-markdown report rendered inline in the conversation. Use when the user passes `--terminal`, `--inline`, `--no-html`, "show the full report inline," or any natural-language equivalent. No HTML file is written.

Both modes carry the same audit content; only the rendering differs. Do not summarize — users want full per-lens perspectives.

---

## HTML mode

### Canonical references

| File                              | Role                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/report-template.html` | **Source of truth.** Full worked example (fictional "Tally" habit tracker, React + Framer Motion). Every section, every token, every pattern. When in doubt about layout, structure, or styling, READ this file. |
| `references/demo-shell.html`      | Minimal isolated example of a single demo card with the per-finding slot pattern. Used as a per-finding template snippet.                                                                                        |

The agent builds the report by reading these two files and adapting them to the audited project — same architecture, audit-specific content.

### File structure

Single self-contained `.html`. All CSS inlined. No external JS. Fonts loaded via Google Fonts CDN (Familjen Grotesk / Public Sans / Geist Mono) with full system-stack fallbacks so the file degrades gracefully offline.

```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{project-name} motion audit — {ISO date}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* 1. :root token block (neutrals, accent aliases, severity, timing ramp, spacing, fonts)
       2. :root:has(#theme-light:checked) light-mode token override
       3. Layout + component CSS (header, lens-table, timing-figure, lens-sec, finding-row, demo, rec, ref-summary)
       4. Per-finding @keyframes m{n} + .demo-{n}__mt rules, one block per Critical or Important finding,
          {n} = 1-indexed across the whole report (collision-free) */
  </style>
</head>
<body>
  <!-- Global theme switch (Dark/Light radios) -->
  <!-- Header (eyebrow, title, lede, meta, stats) -->
  <!-- Overall Assessment -->
  <!-- 01 · Lens summary table -->
  <!-- 02 · Where the timings land (duration-budget diagram) -->
  <!-- 03–05 · Per-lens sections (Jakub, Emil, Jhey — ordered by weighting for the audited context) -->
  <!-- 06 · Combined recommendations tables -->
  <!-- 07 · Lens reference summary -->
  <!-- footer -->
</body>
</html>
```

### Design system

Neutral-default, dual-mode, severity-driven.

- **Neutrals.** Cool slate-graphite at hue 255, very low chroma (0.003–0.010). `--ink` is the page background; `--paper` is the foreground text. In light mode the two swap values via the `:root:has(#theme-light:checked)` override — every other token derives from these two and flips automatically.
- **Severity (FIXED, never adaptive).** Red `oklch(0.655 0.185 25)` (critical) · Amber `oklch(0.805 0.125 78)` (important) · Green `oklch(0.745 0.135 152)` (opportunity). Light-mode counterparts deepen L for contrast on white; hues stay constant.
- **Timing-budget ramp (FIXED).** Same hues as severity; used in section 02 only. Instant + responsive = green, deliberate = amber, sluggish = red.
- **Accent (NEUTRAL by default).** `--accent`, `--accent-soft`, `--accent-tint` alias to `--paper`, `--paper-dim`, and a low-alpha paper tint. The report has no chromatic primary color — severity is the only color in the document. An individual audit MAY repoint these three to a sampled brand color, but ONLY if the brand has at least ~40° hue clearance from each of the severity hues and is verified not to fall in the AI-cliché zone (neon cyan, purple-to-blue gradients).
- **Fonts.** Display = Familjen Grotesk, body = Public Sans, mono = Geist Mono. The mono carries timing values (`240ms · ease-out`) and all small labels — never substitute a more generic mono for the timing values.

### Dual theme

Pure-CSS toggle. Two radios (`#theme-dark` default-checked, `#theme-light`) live inside `.theme-switch` at the top of `.wrap`. `:root:has(#theme-light:checked)` overrides every theme-dependent token. No JS. Selector compatibility: `:has()` is Baseline 2023, supported by all modern browsers.

The global toggle's visual control is a segmented `Dark / Light` pill, top-right of the page, styled to match the per-demo stage segmented control.

### The report's motion posture

**The report itself has no entrance, scroll, or mount animation.** No staggered reveals. No fade-in-on-scroll. No motion on mount outside the demo cards. The demo cards are the only animated elements in the document — anything else would reproduce the AI-slop patterns this skill audits against.

The one allowed transition: `border-color 0.2s ease` on lens-table rows and finding-rows for hover feedback. That's it.

### Sections (in render order)

#### Global theme switch

First element inside `.wrap`, right-aligned segmented `Dark / Light` pill.

#### Header

```
.eyebrow ("MOTION AUDIT · DESIGN-MOTION-PRINCIPLES")
h1.title ({project name} — {one-line audit framing})
p.lede ({1–2 sentence project description})
.meta-row (what it is · stack)
.stats (Findings · Critical · Important · Opportunities — each is an anchor link to its rec table)
```

Each severity count pairs the number with a text label so the signal is readable under red-green color vision deficiency. Each count is an anchor link (`#rec-crit`, `#rec-imp`, `#rec-opp`) to the corresponding recommendation table.

#### Overall Assessment

One short paragraph in larger display type. Does this feel polished? Too much? Too little? What's working, what's not? Wraps in `<section class="assessment">` with a `mono-label` "OVERALL" eyebrow.

#### 01 · Lens summary

3-row table, one row per practitioner. Columns: Lens (with name and weight chip) · Verdict (`Strong` / `Concern` / `Problem` / `Mixed` with a colored dot) · One-line read. Weight chips indicate `Primary` / `Secondary` / `Selective` per audit context.

#### 02 · Where the timings land — duration-budget diagram

Motion-native analog of thumb-first's thumb-zone diagram. A horizontal SVG (`viewBox="0 0 660 300"`) plots Tally's animations as numbered dots on a 0–600ms scale with four zone bands:

| Zone       | Range     | Color              |
| ---------- | --------- | ------------------ |
| Instant    | 0–100ms   | green (`--t-good`) |
| Responsive | 100–300ms | green (`--t-good`) |
| Deliberate | 300–500ms | amber (`--t-mid`)  |
| Sluggish   | 500ms+    | red (`--t-slow`)   |

Animations with NO transition are plotted as hollow dashed circles at `x=40` (= 0ms). The paired key list to the right carries the action names and durations. A "What's off" block below explains the misalignments.

The SVG uses CSS-class-driven fills (via an inline `<style>` block) so the diagram re-tones with the global theme. Dot label color flips per theme (dark text on lighter dots in dark mode, light text on deeper dots in light mode).

#### 03–05 · Per-lens sections

Three sections, ordered by weighting (primary first). Each section:

```
.lens-sec__head (h3 "Designer — Perspective" + .lens-sec__weight chip)
p.lens-sec__verdict (verdict dot)

.lens-block "What's working well"  (ul.lens-list.good with ✓ markers + file refs)
.lens-block "Issues to address"    (one .finding-row per Critical/Important finding)
.lens-block "Opportunities"        (ul.lens-list.opp with 💡 markers + file refs)

.lens-take ("Through {Designer}'s lens: {1–2 sentence summary}")
```

Section heading: `Designer Name — Perspective Handle` (em-dash). Lens take is the documented lens summary, NOT a quote from the person — render as `Through {Designer}'s lens` (apostrophe-s).

Three perspective handles:

| Designer      | Handle                    |
| ------------- | ------------------------- |
| Emil Kowalski | Restraint & Speed         |
| Jakub Krehel  | Production Polish         |
| Jhey Tompkins | Experimentation & Delight |

#### Finding rows (Critical + Important only)

Each Critical or Important finding renders as a `.finding-row` inside its lens's "Issues to address" block:

```
.finding-row[data-sev="crit|imp"]
  .finding-row__prose
    .find-tags (severity chip + 1–2 lens chips)
    h4.find-title
    .find-body
      <p><span class="label">What</span>{prose}</p>
      <p><span class="label">Why it matters</span>{prose}</p>
      <div class="fix"><p><span class="label">Recommended motion</span>{prose}</p></div>
      <p class="find-loc"><code>{file:line}</code></p>
  .demo
    {radios + bar + stage with motion-target}
```

Two-column at desktop (1fr 380px), stacks at narrow widths (≤860px).

Opportunities never render a `.finding-row` and never get a demo card. They appear in the per-lens `.lens-block "Opportunities"` as a `.lens-list.opp` bulleted list.

#### 06 · Combined recommendations

Three severity-grouped tables, in order: `Critical · must fix` (`#rec-crit`) → `Important · should fix` (`#rec-imp`) → `Opportunities · could enhance` (`#rec-opp`). Each has a `.tier-label` with severity-colored mono label, a horizontal rule, and a count. Columns: Issue · File · Fix (or Enhancement · Where · Impact for opportunities).

#### 07 · Lens Reference Summary

Closing `.ref-summary` block. Which lens was referenced most + why + how to lean differently (one line per lens). No new findings here.

#### Footer

Mono micro-row: project name + finding counts.

### Demo cards (the centerpiece)

Each Critical or Important finding gets one demo card. The card is the ONLY animated element in the report.

#### Markup pattern

```html
<div class="demo">
  <input class="vh" type="radio" name="st{n}" id="st{n}-a" checked />
  <input class="vh" type="radio" name="st{n}" id="st{n}-l" />
  <input class="vh" type="radio" name="st{n}" id="st{n}-d" />
  <div class="demo__bar">
    <div class="demo__meta">
      <span class="demo__title">{recommended motion title}</span>
      <span class="demo__timing">{duration} · {easing}</span>
    </div>
    <div class="demo__controls">
      <div class="seg">
        <label for="st{n}-a">Auto</label>
        <label for="st{n}-l">Light</label>
        <label for="st{n}-d">Dark</label>
      </div>
      <span class="demo__loop">↻</span>
    </div>
  </div>
  <div class="demo__stage">
    <div class="demo-{n}__mt">{motion target markup}</div>
  </div>
</div>
```

`{n}` is the finding's 1-indexed position across the whole report (not per-section). This guarantees `@keyframes m{n}` and `.demo-{n}__mt` selectors are unique across the concatenated `<style>` block.

#### Stage 3-state toggle

| State              | Behavior                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Auto** (default) | Stage colors follow the global theme via `--surface-2` + `--paper` tokens. Matches the rest of the report.      |
| **Light**          | Hardcoded light stage (`--st-bg: oklch(0.985 0.003 255)`, `--st-fg: oklch(0.180 0.006 255)`). Overrides global. |
| **Dark**           | Hardcoded dark stage (inverted). Overrides global.                                                              |

Pure CSS. Radio inputs precede `.demo__bar` and `.demo__stage` so sibling-combinator selectors (`#stN-l:checked ~ .demo__stage`) work.

#### Stage tokens (used by motion targets)

| Token       | Role                                         |
| ----------- | -------------------------------------------- |
| `--st-bg`   | Stage background color                       |
| `--st-fg`   | Foreground / text / "ink" color on the stage |
| `--st-line` | Border / divider color on the stage          |
| `--st-dim`  | Dimmed text color on the stage               |

Motion-target elements (`.ui-btn`, `.ui-card`, `.ui-row`, `.ui-check`, `.ui-num`, `.ui-label`, milestone badge, etc.) use `--st-fg` / `--st-bg` instead of `--accent` / page colors. This guarantees correct contrast even when a stage is locked to a different theme than the page.

#### Per-finding motion code

For each Critical or Important finding `{n}`:

1. **Generate motion code.** Read the audited code, the relevant lens reference (`emil-kowalski.md` / `jakub-krehel.md` / `jhey-tompkins.md`), and `references/motion-cookbook.md` for the concrete recipe. Author a `@keyframes m{n}` block and a `.demo-{n}__mt { animation: m{n} 3s {easing} infinite; }` rule.
2. **Loop pacing.** `animation-duration: 3s`. Keyframes at `0%` / `~60%` / `100%`. Motion completes by ~60% (~1.8s), then holds until `100%` (~1.2s) before looping. The `100%` state MUST match the motion-target's default (no-animation) static rendering — this is the `prefers-reduced-motion` fallback contract.
3. **Inject into `<style>`.** Append the `@keyframes m{n}` + `.demo-{n}__mt` block to the report's `<style>`, after the layout CSS, inside a `@media (prefers-reduced-motion: no-preference) { ... }` guard.
4. **Inject demo-card markup.** Append the `.demo` block to the finding's `.finding-row`. Set `.demo__title` to a short motion title (e.g., "Quick tab crossfade"). Set `.demo__timing` to duration + easing (e.g., "180ms · ease-out").
5. **Honor reduced-motion.** The shell's `@media (prefers-reduced-motion: reduce)` block disables all `[class*="__mt"]` animations and hides the `↻` loop indicator. The per-finding `100%` keyframe state must match the motion-target's default static rendering. Do NOT write per-finding overrides inside the reduce-motion block.

### Empty-state behavior

When the audit produces zero Critical + zero Important findings:

- Header still renders with the severity counts (showing `Critical: 0 · Important: 0 · Opportunities: N`).
- Each per-lens "Issues to address" `.lens-block` still renders its `.mono-label`, but the body shows a dimmed-italic line:
  ```html
  <p class="lens-empty">No issues found at this severity level.</p>
  ```
- No `.finding-row` markup, no demo cards.
- Opportunities still render as `.lens-list.opp` lists.
- Combined recommendations tables render with empty `<tbody>` containing a single dimmed-italic row, OR are omitted entirely if their tier has zero findings.

### Responsive behavior

- `.finding-row` 2-col → 1-col at ≤860px (demo stacks below prose).
- `.timing-grid` 2-col → 1-col at ≤860px (key list stacks below SVG).
- `.lens-table` → stacked blocks at ≤600px (each row becomes a block, headers hidden).
- `.ref-lean` 2-col → 1-col at ≤600px.

### Absolute bans

- **NO `border-left` or `border-right` >1px as a colored accent stripe** on cards, list items, callouts, or alerts. Use full borders, leading numbers, tinted backgrounds, or no visual indicator instead. (The previous version of this spec had `border-left: 3px solid var(--accent)` on the lens-take block — removed.)
- **NO gradient text** (`background-clip: text` + gradient).
- **NO pulsing UI** in any demo (looping scale/opacity on status indicators, "live" pulse rings, breathing CTAs). Demo motion is structured one-shot enters that loop, not attention-getting pulses.
- **NO chromatic accent in the default system.** The neutral-default is the supported configuration. Repointing `--accent` to a sampled brand color is permitted only when severity-hue clearance is verified.

---

## Terminal mode (flag-triggered fallback)

When the user passes `--terminal` / `--inline` / a natural-language equivalent, do not write an HTML file. Render the decorated-markdown report inline in the conversation.

### Quick Summary (show first)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 AUDIT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 [X] Critical  |  🟡 [X] Important  |  🟢 [X] Opportunities
Primary lens: [Designer] ([context reason])
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Overall Assessment

One paragraph: Does this feel polished? Too much? Too little? What's working, what's not?

### Per-Designer Sections

For each designer (Emil, Jakub, Jhey — ordered by weighting), use a horizontal-rule header and the body format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ EMIL KOWALSKI — Restraint & Speed       (Secondary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What's Working Well
- ✓ [Observation] — `file.tsx:line`

Issues to Address
- ✗ [Issue] — `file.tsx:line`
  [Brief explanation]
  Recommended: [Brief recommendation]

Through Emil's lens: [1–2 sentence summary]
```

### Combined Recommendations

Three severity tables:

```
Critical · Must Fix
| | Issue | File | Fix |
|-|-------|------|-----|
| 🔴 | [Issue] | `file:line` | [Fix] |

Important · Should Fix
| | Issue | File | Fix |
|-|-------|------|-----|
| 🟡 | [Issue] | `file:line` | [Fix] |

Opportunities · Could Enhance
| | Enhancement | Where | Impact |
|-|-------------|-------|--------|
| 🟢 | [Enhancement] | `file:line` | [Impact] |
```

### Lens Reference Summary

```
> Lens referenced most: [Designer Name] — [Perspective]
>
> Why: [Explanation based on the project context]
>
> If you want to lean differently:
> - To follow Emil more strictly: [specific actions]
> - To follow Jakub more strictly: [specific actions]
> - To follow Jhey more strictly: [specific actions]
```

---

## Mode selection

Default to HTML mode. Trigger terminal mode only when the user explicitly signals it via:

- `--terminal` / `--inline` / `--no-html` flag
- Natural-language equivalent: "show the full report inline," "skip the HTML," "no HTML," "terminal only"
- Any headless or CI environment where opening a browser doesn't apply

When defaulting to HTML, mention in the 3-line confirmation summary (see `workflows/audit.md`) that `--terminal` is the alternative — so the user knows it exists.
