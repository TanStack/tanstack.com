# Workflow: Create Mode

Build interactive components with purposeful motion. Light discovery, then generate against the cookbook.

## Required Reading

Read before generating:

1. `references/motion-cookbook.md` — the recipe source for all motion code
2. `references/accessibility.md` — `prefers-reduced-motion` is mandatory in everything you generate
3. `references/creation-gotchas.md` — Claude's failure modes when writing motion; self-check against these

---

## STEP 1: Light Discovery

Establish two things — project context and designer weighting — before generating. Keep it to 1-2 questions.

### Infer First, Ask Second

Check what you can already see:

- **The request** — what component, what interaction, what stack (React / Framer Motion / CSS / HTML)?
- **CLAUDE.md, package.json, existing components** — project type and existing animation conventions (durations, easing, libraries)

### Propose Context + Weighting

Map the project type to a perspective weighting using the Context-to-Perspective Mapping table in SKILL.md. State your inference in one short block:

```
Building: [what — e.g. "a notification toast, React + Framer Motion"]
Project context: [inferred — e.g. "productivity SaaS dashboard"]
Proposed weighting: Primary [Designer] · Secondary [Designer]
```

If `AskUserQuestion` is available and the weighting is genuinely ambiguous, offer:

- **Confirm** — proceed with the proposed weighting
- **Adjust** — change primary/secondary designer

Otherwise ask in plain text: "Does this weighting sound right, or should I adjust?"

### Wait Gate

For non-trivial components, **confirm context before generating**. For a small, well-specified request ("add a press-scale to this button"), state the inference in one line and skip straight to STEP 3 — don't manufacture a question.

---

## STEP 2: Load Weighted Knowledge

Based on the confirmed weighting, read the relevant designer file(s):

- **Read `references/emil-kowalski.md`** if Emil is primary/secondary — restraint, the frequency rule, when NOT to animate
- **Read `references/jakub-krehel.md`** if Jakub is primary/secondary — production polish judgment, subtlety bar
- **Read `references/jhey-tompkins.md`** if Jhey is primary/secondary — playful expression, what motion could become

The designer files give you the **judgment** (should this animate, what feel). The cookbook gives you the **code**.

If the component involves complex or numerous animations, also read `references/performance.md`.

---

## STEP 3: Generate

Build the component. Apply, in order:

1. **The frequency gate (Emil)** — Should this animate at all? High-frequency or keyboard-initiated interactions get minimal or no motion. Decide before adding anything.
2. **Recipes from the cookbook** — Use the weighted designer's patterns. Enter = opacity + translateY + blur. Exit subtler than enter. Custom easing or springs, never bare `ease`.
3. **Accessibility** — Every animation ships with `prefers-reduced-motion` handling, in the same code. No exceptions, no follow-up.
4. **Performance** — Animate `transform` / `opacity` / `filter` only. Never `width` / `height` / `top` / `left`.
5. **Context-appropriate timing** — Emil-weighted → under 300ms. Jakub → 200-500ms polish. Jhey → whatever serves the effect.

---

## STEP 4: Self-Check

Before presenting, verify the generated code against every item in `references/creation-gotchas.md`. Fix anything that matches a gotcha.

Then briefly tell the user the motion decisions you made and why — which designer weighting drove the timing, easing, and whether something was deliberately left un-animated.

---

## Success Criteria

- [ ] Context and weighting confirmed (or inference stated for trivial requests)
- [ ] Frequency gate applied — motion is purposeful, not decorative-by-default
- [ ] Recipes drawn from the cookbook, matched to the designer weighting
- [ ] `prefers-reduced-motion` handled in all generated motion
- [ ] Only `transform` / `opacity` / `filter` animated
- [ ] Code self-checked against creation-gotchas.md
- [ ] Motion decisions explained to the user
