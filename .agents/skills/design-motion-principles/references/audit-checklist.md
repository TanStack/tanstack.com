# Audit Checklist

Use this checklist when reviewing motion design in any UI code.

---

## Philosophy Check (Do First)

- [ ] **How often will users trigger this?** (Frequent = less/no animation — Emil's rule)
- [ ] **Is this keyboard-initiated?** (If yes, don't animate — Emil's rule)
- [ ] **Does this animation serve a purpose?** (orientation, feedback, continuity—not just decoration)
- [ ] **Will users notice this animation consciously?** (If yes for production UI, probably too much)
- [ ] **Have I tested this with `prefers-reduced-motion: reduce`?**
- [ ] **Does this feel natural after the 10th interaction?** (Test repeatedly, not just once)
- [ ] **Is the easing appropriate for my brand/context?**
- [ ] **Is the duration appropriate for context?** (Emil prefers under 300ms; Jakub/Jhey may use longer for polish or effect)

---

## Motion Gap Analysis (Check BEFORE Reviewing Existing Animations)

Conditional UI changes that **lack** animation are often worse than poorly-tuned animations:

- [ ] **Searched for conditional renders** — `{condition && <Component />}` patterns
- [ ] **Searched for ternary swaps** — `{condition ? <A /> : <B />}` patterns
- [ ] **Searched for dynamic inline styles** — `style={{ prop: dynamicValue }}` without transition
- [ ] **Each conditional render** either has AnimatePresence wrapper OR doesn't need animation (static content)
- [ ] **Mode switches** (tabs, toggles) animate their content changes, not just the switch itself
- [ ] **Settings panels** with conditional controls have enter/exit animations
- [ ] **Expandable sections** animate height, not just show/hide
- [ ] **Loading → Content** transitions are smooth, not instant swaps

---

## Enter/Exit States

- [ ] Enter animations combine opacity + translateY + blur
- [ ] Exit animations are subtler than enters (smaller translateY, same blur/opacity)
- [ ] `animation-fill-mode: backwards` used for delayed sequences
- [ ] Elements don't flash before their delayed animation starts

---

## Easing & Timing

- [ ] Appropriate easing for context (not default `ease` everywhere)
- [ ] Custom Bézier curves used instead of built-in easing (Emil's rule)
- [ ] Spring animations for interactive elements
- [ ] Durations appropriate for context (Emil: under 300ms; others: whatever serves the design)
- [ ] Consistent timing values across related animations
- [ ] Transform-origin matches interaction source (dropdowns from trigger)

---

## Visual Polish

- [ ] Shadows instead of borders where background varies
- [ ] Gradients using oklch color space for smooth blending
- [ ] Blur used intentionally as a state signal

---

## Optical Alignment

- [ ] Buttons with icons have adjusted padding
- [ ] Asymmetric icons (play, arrows) are visually centered
- [ ] Text and icons feel balanced

---

## State Transitions

- [ ] Icon swaps are animated (opacity, scale, blur)
- [ ] Loading states have smooth transitions
- [ ] Hover states have transitions (150-200ms minimum)
- [ ] Button press has scale feedback (`scale(0.97)` on `:active`)
- [ ] Elements don't animate from `scale(0)` (use `0.9+` instead)

---

## Interaction Patterns (Emil's Rules)

- [ ] Tooltips: first delayed + animated, subsequent instant
- [ ] Animations are interruptible (can change mid-animation)
- [ ] Clip-path used for reveals instead of width/height
- [ ] High-frequency actions have minimal or no animation
- [ ] Keyboard shortcuts don't animate

---

## Performance

- [ ] `will-change` used sparingly and specifically
- [ ] Animations use transform/opacity (not layout properties)
- [ ] Tested on low-end devices
- [ ] No continuous animations without purpose
- [ ] CSS transitions (not keyframes) for interruptible animations (Emil)
- [ ] Direct style updates for drag operations (not CSS variables) (Emil)
- [ ] Velocity-based thresholds (not distance) for swipe dismiss (Emil)

---

## Accessibility

- [ ] Respects `prefers-reduced-motion`
- [ ] No vestibular triggers (excessive zoom, spin, parallax)
- [ ] Looping animations can be paused
- [ ] Functional animations have non-motion alternatives

---

## Quick Reference: Severity Levels

**Critical (Must Fix)**:

- Missing `prefers-reduced-motion` support
- Animating layout properties (width, height, top, left)
- No exit animations (elements just disappear)
- **Motion gaps in primary UI** — Conditional controls/panels that snap in/out without animation
- Animating keyboard-initiated actions (Emil)
- Animations on high-frequency actions (100s/day)

**Important (Should Fix)**:

- Exit animations as prominent as enter animations
- Missing blur in enter animations
- Animating from `scale(0)` instead of `0.9+` (Emil)
- Default CSS easing instead of custom curves (Emil)
- Wrong transform-origin on dropdowns/popovers (Emil)

**Context-Dependent (Check Against Designer Perspective)**:

- Durations over 300ms (Emil flags this; Jakub/Jhey may approve for polish)

**Nice to Have**:

- Optical alignment refinements
- oklch color space for gradients
- Spring animations instead of ease
- Button scale feedback on press
- Tooltip delay pattern (first delayed, subsequent instant)
