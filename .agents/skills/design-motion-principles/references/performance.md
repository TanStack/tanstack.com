# Performance

---

## will-change Explained (Jakub)

A hint to the browser: "I'm about to animate these properties, please prepare."

```css
/* Good - specific properties that will animate */
.animated-button {
  will-change: transform, opacity;
}

/* Bad - too broad, wastes resources */
* {
  will-change: auto;
}
.element {
  will-change: all;
}
```

**Properties that benefit from will-change**:

- transform
- opacity
- filter (blur, brightness)
- clip-path
- mask

**Why it matters**: Without the hint, the browser promotes elements to GPU layers only when animation starts, causing first-frame stutter. With `will-change`, it pre-promotes during idle time.

**When NOT to use**:

- On elements that won't animate
- On too many elements (each GPU layer uses memory)
- As a "fix" for janky animations (find the real cause)

---

## Gradient Animation Performance (Jakub)

**Cheap to animate (GPU-accelerated)**:

- background-position
- background-size
- opacity

**Expensive to animate**:

- Color stops
- Adding/removing gradient layers
- Switching gradient types

**Tip**: Animate a pseudo-element overlay or use CSS variables that transition indirectly.

---

## Animation Performance Budget

As a rough guide:

- **0-3 elements** with `will-change`: Fine
- **4-10 elements**: Careful, test on low-end devices
- **10+ elements**: Reconsider approach, use virtualization or stagger

---

## Properties to Avoid Animating

These trigger layout recalculation (expensive):

- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`
- `font-size`

**Always prefer**:

- `transform: translate()` instead of `top`/`left`
- `transform: scale()` instead of `width`/`height`
- `opacity` for visibility changes

---

## Performance Checklist

- [ ] `will-change` used sparingly and specifically
- [ ] Animations use transform/opacity (not layout properties)
- [ ] Tested on low-end devices
- [ ] No continuous animations without purpose
- [ ] GPU layer count is reasonable (< 10 animated elements)
