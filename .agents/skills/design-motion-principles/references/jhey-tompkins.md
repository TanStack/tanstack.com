# Jhey Tompkins' Animation Principles

Jhey Tompkins (@jh3yy) is a design engineer known for pushing the boundaries of CSS and creative coding. His approach emphasizes **playful experimentation** — learning through building whimsical projects where the joy of creation drives skill development.

This file is Jhey's **philosophy and decision frameworks** — the judgment for _creative expression_ and _easing personality_. Implementation code lives in `motion-cookbook.md` (cross-referenced below).

---

## Core Philosophy: Learn Through Play

> "I went from 'I want to learn X, so how do I fit it into Y' to 'I want to make Y, can I learn X to do it?'"

His key question for any interaction: **"What could this become?"**

**The motivation should be making something cool — learning is a happy side effect.**

### Core Beliefs

- **No idea is a bad idea** — Document every spark, however weird
- **Don't ask "Why?" or "Is this practical?"** — Make what brings you joy first
- **"Useless" demos teach real skills** — CSS art teaches clip-path mastery, border-radius tricks, stacking contexts
- **Lateral learning** — Building diverse demos trains you to switch contexts and rise to challenges
- **You'll never have time to make everything** — And that's okay. The act of documenting ideas matters.

**Keep notebooks everywhere** — including by your bed. Creative sparks happen at random times.

---

## When to Apply Jhey's Mindset

- Creative sites, portfolios, kids apps — contexts where delight is the point
- Learning new techniques
- Personal projects and experiments
- When you're stuck in a creative rut
- Exploring what's possible with new CSS features

---

## The Golden Rule (Even in Play)

> "The best animation is that which goes unnoticed."

Even in playful contexts, effective motion enhances the experience without demanding attention, feels natural and expected, serves a functional purpose, and doesn't fatigue users on repeated interactions.

---

## Easing Has Personality (Decision Framework)

> "Duration is all about timing, and timing has a big impact on the movement's naturalness."

Each easing curve communicates something. **Context matters more than rules.**

> "You wouldn't use 'Elastic' for a bank's website, but it might work perfectly for an energetic site for children."

Brand personality should drive easing choices — a playful brand can use bouncy/elastic easing, a professional brand should use subtle springs or `ease-out`.

**When NOT to use bouncy/elastic easing:**

- Professional/enterprise applications
- Frequently repeated interactions (gets tiresome)
- Error states or serious UI
- When users need to complete tasks quickly

(Easing-feel reference table and the `linear()` recipe for pure-CSS bounce/elastic/spring → cookbook §2.)

---

## Signature Techniques (decision context — code in cookbook)

| Technique                   | When Jhey reaches for it                                                 | Cookbook |
| --------------------------- | ------------------------------------------------------------------------ | -------- |
| `linear()` function         | Pure-CSS bounce, elastic, spring effects without JS                      | §2       |
| `@property`                 | Animating CSS custom properties — type declaration unlocks interpolation | §7       |
| Decomposed transforms       | Curved motion paths impossible with a monolithic transform               | §7       |
| `animation-fill-mode`       | Delayed fade-in sequences — `backwards` prevents the pre-animation flash | §1       |
| Negative delays             | "Already in progress" stagger effects                                    | §2       |
| Scoped CSS variables        | Varied behavior from a single animation definition                       | §7       |
| 3D CSS ("think in cubes")   | Decompose 3D objects into cuboids; `preserve-3d` + `perspective`         | §8       |
| Scroll-driven with duration | Decouple animation timing from scroll speed                              | §14      |

---

## Why "Useless" CSS Art Matters

CSS art teaches real skills that transfer to production: clip-path mastery, border-radius tricks, stacking contexts, complex gradients, pseudo-element layering. For complex illustrations — break into simple shapes, use pseudo-elements liberally, layer with z-index carefully, use CSS variables for repeated values, don't fear many elements.

---

## When to Experiment vs. Ship

| Situation                  | Approach                                |
| -------------------------- | --------------------------------------- |
| Learning a new CSS feature | Build something weird and fun           |
| Portfolio piece            | Push boundaries, show creativity        |
| Personal project           | Follow your joy                         |
| Client work                | Apply Jakub's production polish instead |
| High-frequency tool        | Apply Emil's restraint instead          |

The playful approach is for **learning and exploration**. For production, switch to Jakub or Emil's mindset.

---

## Common Mistakes (Jhey's Perspective)

- **Filtering ideas based on "usefulness" too early** — Make first, judge later
- **Not documenting random creative sparks** — Keep notebooks everywhere
- **Thinking CSS art is useless** — It teaches real skills
- **Focusing on "How do I learn X?" instead of "How do I make Y?"** — Let ideas drive learning
- **Following tutorials without experimenting** — Tutorials teach techniques; experimentation teaches problem-solving
- **Giving up when something doesn't work** — The struggle is where learning happens

---

## Jhey vs. Emil vs. Jakub

| Aspect                  | Jhey                      | Emil                      | Jakub                       |
| ----------------------- | ------------------------- | ------------------------- | --------------------------- |
| **Focus**               | Playful experimentation   | Restraint & speed         | Subtle polish               |
| **Key question**        | "What could this become?" | "Should this animate?"    | "Is this subtle enough?"    |
| **Signature technique** | CSS custom properties     | Frequency-based decisions | Blur + opacity + translateY |
| **Ideal context**       | Learning & exploration    | High-frequency tools      | Production polish           |

**When to use Jhey**: You're building something where delight is the goal, exploring what's possible, or learning a new technique. The skills transfer to production work later.
