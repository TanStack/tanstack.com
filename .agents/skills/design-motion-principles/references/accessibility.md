# Accessibility

**This is not optional.** Motion can cause discomfort, nausea, or distraction for many users.

---

## Respect User Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**What this does**: Effectively disables animations while preserving final states (so layouts don't break).

---

## Functional vs. Decorative Motion

| Type           | Purpose                                                     | Reduced Motion Behavior                                    |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| **Functional** | Indicates state changes, spatial relationships, orientation | May need alternative (instant state change, no transition) |
| **Decorative** | Pure delight, visual interest                               | Can be fully removed                                       |

**The test**: Does removing this animation break the user's ability to understand what happened? If yes, it's functional.

---

## Motion Sensitivity Considerations

- Avoid large-scale motion (full-screen transitions, parallax)
- Avoid continuous or looping animations that can't be paused
- Provide pause controls for any ambient animation
- Be especially careful with vestibular triggers: zooming, spinning, parallax

---

## Implementation Checklist

- [ ] Tested with `prefers-reduced-motion: reduce` enabled
- [ ] No vestibular triggers (excessive zoom, spin, parallax)
- [ ] Looping animations can be paused
- [ ] Functional animations have non-motion alternatives
- [ ] Users can complete all tasks with animations disabled
