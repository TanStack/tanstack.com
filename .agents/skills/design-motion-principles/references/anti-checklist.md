# Anti-Checklist

This file is the audit's quality gate. The categories below describe motion patterns to **flag** in audited code — AI-slop tells at the top (where most 2026 motion problems live), followed by perspective-specific anti-patterns from Emil, Jakub, and Jhey, then general motion mistakes and code-shaped red flags. When audited code matches a pattern here, the audit surfaces a finding and the agent generates a per-finding motion suggestion by reading the relevant philosophy reference (`emil-kowalski.md`, `jakub-krehel.md`, `jhey-tompkins.md`).

The file frames patterns as "things to flag," not "mistakes to avoid" — language that makes the audit's adversarial posture explicit.

---

## AI-Slop Motion Patterns

These are the recognizable motion fingerprints of AI-generated UIs in 2026. They're not always wrong in isolation — what makes them slop is _frequency_ and _uniformity_. Finding one instance is normal polish; finding the same pattern slapped across the codebase is the tell. Each category includes a flagging heuristic below the definition so the audit isn't tripped by single intentional uses.

---

### Pulsing indicators

Glowing dots, breathing CTAs, throbbing rings, "live"/"online"/"recording"/"AI active" pulse animations, dark-mode pulse glows — any looped scale/opacity pulse used to draw attention to a status element.

**Flag when you see:**

- `@keyframes` rules with names containing `pulse`, `glow`, `breathe`, `throb`
- `animation: ... infinite` on small UI elements (dots, badges, status indicators)
- `box-shadow` or `opacity` loops on status icons
- Tailwind `animate-pulse` on indicator dots or active-state elements

**Heuristic:** Flag _any_ instance. Pulsing indicators are almost always slop — the only exception is a single brand element with explicit design rationale stated in code comments or design docs.

**Fix lens:** Emil — purposeful restraint. See `references/emil-kowalski.md`.

---

### Blur-everywhere entrances

`filter: blur(Npx)` applied to every entering element on mount — sections, cards, images, paragraphs. Jakub's enter recipe (`opacity + translateY + blur`) is excellent in moderation; AI-slop versions apply it uniformly across the page.

**Flag when you see:**

- `initial={{ filter: 'blur(Npx)' }}` or `from { filter: blur(Npx); }` on multiple distinct components in the same view
- Identical blur values (e.g., `blur(4px)`) repeated across components without context distinction
- Blur on text-bearing entrances (headings, paragraphs) where it impairs first-paint readability

**Heuristic:** Flag when ≥3 distinct components in the same view share the same `filter: blur()` enter pattern. Single uses with intent (a hero element, a modal) are fine.

**Fix lens:** Jakub — production polish, but selective. See `references/jakub-krehel.md`.

---

### Hover-scale-on-everything

`transform: scale(1.0X)` on `:hover` applied to every card, button, and image without intent. The micro-bounce-on-hover feels polished in moderation; AI-slop versions slap it on indiscriminately.

**Flag when you see:**

- `transition` rules with `transform: scale(1.0X)` on `:hover` across multiple card/button/image components
- Identical scale values (e.g., `scale(1.05)`) repeated across selectors with no discriminating context
- Tailwind `hover:scale-105` applied to grids of repeated items

**Heuristic:** Flag when ≥3 distinct components share the same `transform: scale(1.0X)` on `:hover` with no other discriminating selector context. Single intentional uses (e.g., a primary CTA) are fine.

**Fix lens:** Emil for utility-shaped elements (none); Jakub for product-shaped elements (selective). See `references/emil-kowalski.md` and `references/jakub-krehel.md`.

---

### Stagger-spam-on-every-list

`stagger`, `staggerChildren`, or hand-rolled `animation-delay: calc(var(--i) * 50ms)` patterns applied to every list, grid, or repeated-element block. Jhey-style stagger on a deliberate moment is delightful; AI-slop spreads it across every list as default polish.

**Flag when you see:**

- `staggerChildren` in framer-motion `variants` across multiple list components
- `animation-delay: calc(...)` with item-index multipliers across multiple components
- Sequential delays applied to lists that don't read as a moment (search results, settings options, table rows)

**Heuristic:** Flag when ≥2 lists in the same view use stagger entrance. One intentional moment is fine; two or more is the tell.

**Fix lens:** Emil for utility lists (no stagger); Jhey for delight moments (selective). See `references/emil-kowalski.md` and `references/jhey-tompkins.md`.

---

### Bouncy-springs-on-utility-actions

`type: 'spring'` with bounce on dropdown opens, toggle switches, menu reveals, modal entrances — utility actions where bounce reads as "playful" but the action itself is productivity-oriented.

**Flag when you see:**

- `transition={{ type: 'spring', bounce: > 0 }}` on dropdowns, popovers, menus, toggles, modal opens, settings panels
- CSS `cubic-bezier(...)` with overshoot values on utility elements
- Identical spring configs across utility components

**Heuristic:** Flag _any_ spring with bounce > 0 on a utility action (dropdown, menu, toggle, modal, settings panel). Bounce belongs on playful elements — celebration moments, kids apps, intentional delight — not productivity UI.

**Fix lens:** Emil — speed and purpose. See `references/emil-kowalski.md`.

---

### Uniform-fade-in-on-every-element

Identical `opacity + translateY` (with or without blur) enter animations applied to every section, card, paragraph, and heading. The "polished entrance" treatment from Jakub used uniformly across the page, regardless of element type or context.

**Flag when you see:**

- Multiple components sharing identical `initial`/`animate` opacity+translateY values
- `whileInView` with identical viewport options applied to every block on a page
- CSS keyframes with generic names (`fadeInUp`, `enter`, `reveal`) attached to many selectors

**Heuristic:** Flag when ≥4 distinct components share identical enter animations (same opacity, same translateY, same duration, same easing). Three is acceptable polish baseline; four is uniformity slop.

**Fix lens:** Jakub — selective polish with hierarchy. See `references/jakub-krehel.md`.

---

### Motion-on-mount-for-static-content

Entrance animations on headings, body paragraphs, navigation links, and other content that should appear instantly. The "fade in everything" pattern that delays reading and makes the page feel sluggish.

**Flag when you see:**

- `initial`/`animate` on `<h1>`, `<h2>`, `<p>`, `<nav>` elements
- `whileInView` on body copy (paragraphs, articles, prose)
- `animation` rules on text-only components without functional reason

**Heuristic:** Flag any motion on a text-only or navigation element when the motion's only purpose is the entrance itself. Carousels, sliders, and hero animations are fine when the motion serves a function (orientation, narrative pacing, attention direction).

**Fix lens:** Emil — animations should serve a purpose, not announce themselves. See `references/emil-kowalski.md`.

---

## From Emil's Perspective (Purposeful Restraint)

- **Animating high-frequency interactions** — If users trigger this 100s of times daily, remove the animation
- **Animating keyboard-initiated actions** — Keyboard shortcuts should NEVER animate
- **Animations over 300ms** — UI animations should be under 300ms; 180ms feels more responsive than 400ms
- **Animating from scale(0)** — Start from `scale(0.9)` or higher for natural motion
- **Same tooltip behavior everywhere** — First tooltip: delayed + animated. Subsequent: instant
- **Using default CSS easing** — Built-in `ease` and `ease-in-out` lack strength; use custom curves
- **Ignoring transform-origin** — Dropdowns should expand from their trigger, not center
- **Expecting delight in productivity tools** — Users of high-frequency tools prioritize speed over delight
- **Using keyframes for interruptible animations** — Keyframes can't retarget mid-flight; use CSS transitions with state
- **CSS variables for frequent updates** — Causes expensive style recalculation; update styles directly on element
- **Distance thresholds for dismissal** — Use velocity (distance/time) instead; fast short gestures should work
- **Abrupt boundary stops** — Use damping; things slow down before stopping in real life

---

## From Jakub's Perspective (Production Polish)

- **Making enter and exit animations equally prominent** — Exits should be subtler
- **Using solid borders when shadows would adapt better** — Especially on varied backgrounds
- **Forgetting optical alignment** — Buttons with icons, play buttons, asymmetric shapes
- **Over-animating** — If users notice the animation itself, it's too much
- **Using the same animation everywhere** — Context should drive timing and easing choices
- **Ignoring hover state transitions** — Even small transitions (150-200ms) feel more polished than instant changes

---

## From Jhey's Perspective (Creative Learning)

- **Filtering ideas based on "usefulness" too early** — Make first, judge later
- **Not documenting random creative sparks** — Keep notebooks everywhere, including by your bed
- **Thinking CSS art is useless** — It teaches real skills (clip-path, layering, complex shapes)
- **Focusing on "How do I learn X?" instead of "How do I make Y?"** — Let ideas drive learning
- **Following tutorials without experimenting** — Tutorials teach techniques; experimentation teaches problem-solving
- **Giving up when something doesn't work** — The struggle is where learning happens

---

## General Motion Design Mistakes

- **Animating layout-triggering properties** (width, height, top, left) — Use transform instead
- **No animation at all** — Instant state changes feel broken to modern users
- **Same duration for all animations** — Smaller elements should animate faster
- **Forgetting `prefers-reduced-motion`** — Not optional

_Note: Duration is designer-dependent. Emil prefers under 300ms for productivity tools. Jakub and Jhey may use longer durations when polish or effect warrants it._

---

## Red Flags in Code Review

Watch for these patterns:

```jsx
// BAD: Animating layout properties
animate={{ width: 200, height: 100 }}

// GOOD: Use transform
animate={{ scale: 1.2 }}
```

```jsx
// BAD: Same animation for enter and exit
initial={{ opacity: 0, y: 20 }}
exit={{ opacity: 0, y: 20 }}

// GOOD: Subtler exit
initial={{ opacity: 0, y: 20 }}
exit={{ opacity: 0, y: -8 }}
```

```css
/* BAD: No reduced motion support */
.animated {
  animation: bounce 1s infinite;
}

/* GOOD: Respects user preference */
@media (prefers-reduced-motion: no-preference) {
  .animated {
    animation: bounce 1s infinite;
  }
}
```

```css
/* BAD: will-change everywhere */
* {
  will-change: transform;
}

/* GOOD: Targeted will-change */
.animated-button {
  will-change: transform, opacity;
}
```

```jsx
// BAD: Animating from scale(0) (Emil)
initial={{ scale: 0 }}
animate={{ scale: 1 }}

// GOOD: Start from higher scale
initial={{ scale: 0.9, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
```

```jsx
// Per Emil: Too slow for productivity UI
transition={{ duration: 0.4 }}

// Per Emil: Fast, snappy (but Jakub/Jhey might use 0.4 for polish)
transition={{ duration: 0.18 }}
```

```css
/* BAD: Dropdown expanding from center (Emil) */
.dropdown {
  transform-origin: center;
}

/* GOOD: Origin-aware animation */
.dropdown {
  transform-origin: top center;
}
```

```css
/* BAD: Keyframes can't be interrupted (Emil) */
@keyframes slideIn {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
.toast {
  animation: slideIn 400ms ease;
}

/* GOOD: Transitions can retarget mid-flight */
.toast {
  transform: translateY(100%);
  transition: transform 400ms ease;
}
.toast.mounted {
  transform: translateY(0);
}
```

```javascript
// BAD: CSS variables cause cascade recalc (Emil)
element.style.setProperty('--drag-y', `${y}px`)

// GOOD: Direct style update
element.style.transform = `translateY(${y}px)`
```

```javascript
// BAD: Distance threshold for dismissal (Emil)
if (dragDistance > 100) dismiss()

// GOOD: Velocity-based (fast short gestures work)
const velocity = dragDistance / elapsedTime
if (velocity > 0.11) dismiss()
```
