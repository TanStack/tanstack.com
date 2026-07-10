# Workflow: Audit Mode

Review existing motion design and produce a per-designer report. Reconnaissance first, then a full audit, then a structured report. Never apply rules blindly.

## Required Reading

Read as you reach each step (not all upfront):

1. `references/audit-checklist.md` — your systematic guide (STEP 2)
2. The weighted designer file(s) — `emil-kowalski.md`, `jakub-krehel.md`, `jhey-tompkins.md` (STEP 2)
3. `references/accessibility.md` — mandatory every audit (STEP 2)
4. `references/anti-checklist.md` — the quality gate: AI-slop motion categories + anti-patterns to flag (STEP 2)
5. `references/output-format.md` — the report template, HTML mode + terminal mode (STEP 3)
6. `references/demo-shell.html` — the demo-card template for HTML-mode per-finding demos (STEP 3)

---

## STEP 1: Context Reconnaissance (DO THIS FIRST)

Before auditing any code, understand the project context.

### Gather Context

Check these sources:

1. **CLAUDE.md** — Any explicit context about the project's purpose or design intent
2. **package.json** — What type of app? (Next.js marketing site vs Electron productivity app vs mobile PWA)
3. **Existing animations** — Grep for `motion`, `animate`, `transition`, `@keyframes`. What durations are used? What patterns exist?
4. **Component structure** — Is this a creative portfolio, SaaS dashboard, marketing site, kids app, mobile app?

### Motion Gap Analysis (CRITICAL - Don't Skip)

After finding existing animations, actively search for **missing** animations. These are UI changes that happen without any transition:

**Search for conditional renders without AnimatePresence:**

```bash
# Find conditional renders: {condition && <Component />}
grep -n "&&\s*(" --include="*.tsx" --include="*.jsx" -r .

# Find ternary UI swaps: {condition ? <A /> : <B />}
grep -n "?\s*<" --include="*.tsx" --include="*.jsx" -r .
```

**For each conditional render found, check:**

- Is it wrapped in `<AnimatePresence>`?
- Does the component inside have enter/exit animations?
- If NO to both → this is a **motion gap** that needs fixing

**Common motion gap patterns:**

- `{isOpen && <Modal />}` — Modal appears/disappears instantly
- `{mode === "a" && <ControlsA />}` — Controls swap without transition
- `{isLoading ? <Spinner /> : <Content />}` — Loading state snaps
- `style={{ height: isExpanded ? 200 : 0 }}` — Height changes without CSS transition
- Inline styles with dynamic values but no `transition` property

**Where to look for motion gaps:**

- Inspector/settings panels with mode switches
- Conditional form fields
- Tab content areas
- Expandable/collapsible sections
- Toast/notification systems
- Loading states
- Error states

### State Your Inference

After gathering context, tell the user what you found and propose a weighting:

```
## Reconnaissance Complete

**Project type**: [What you inferred — e.g., "Kids educational app, mobile-first PWA"]
**Existing animation style**: [What you observed — e.g., "Spring animations (500-600ms), framer-motion, active:scale patterns"]
**Likely intent**: [Your inference — e.g., "Delight and engagement for young children"]

**Motion gaps found**: [Number] conditional renders without AnimatePresence
- [List the files/areas with gaps, e.g., "Settings panel mode switches", "Loading states"]

**Proposed perspective weighting**:
- **Primary**: [Designer] — [Why]
- **Secondary**: [Designer] — [Why]
- **Selective**: [Designer] — [When applicable]

Does this approach sound right? Should I adjust the weighting before proceeding with the full audit?
```

Use the Context-to-Perspective Mapping table in SKILL.md to propose the weighting.

### Wait for User Confirmation

**STOP and wait for the user to confirm or adjust.** Do not proceed to the full audit until they respond.

If `AskUserQuestion` is available, present the decision as tappable options:

- **Confirm weighting** — Proceed with the proposed primary/secondary/selective designers
- **Adjust primary** — Swap which designer is primary (e.g., prioritize delight over restraint)
- **Adjust secondary** — Change the secondary lens while keeping primary
- **Rebuild weighting** — The project type inference was wrong; start over

Otherwise ask in plain text: "Does this weighting sound right, or should I adjust?"

If they adjust (e.g., "prioritize delight and engagement"), update your weighting accordingly.

---

## STEP 2: Full Audit (After User Confirms)

Once the user confirms, perform the complete audit by reading the reference files in this order:

### 2a. Read the Audit Checklist First

**Read `references/audit-checklist.md`** — Use this as your systematic guide. It provides the structured checklist of what to evaluate.

### 2b. Read Designer Files for Your Weighted Perspectives

Based on your context weighting, read the relevant designer files:

- **Read `references/emil-kowalski.md`** if Emil is primary/secondary — Restraint philosophy, frequency rules, decision frameworks
- **Read `references/jakub-krehel.md`** if Jakub is primary/secondary — Production polish philosophy, what to check
- **Read `references/jhey-tompkins.md`** if Jhey is primary/secondary — Playful experimentation philosophy, opportunities to surface

### 2c. Read Topical References as Needed

- **Read `references/accessibility.md`** — MANDATORY. Always check for prefers-reduced-motion. No exceptions.
- **Read `references/anti-checklist.md`** — Apply this as the audit's quality gate. AI-slop categories at the top (pulsing indicators, hover-scale-on-everything, stagger-spam, etc.) trigger findings; perspective-specific and general anti-patterns sit below. Each category includes a frequency heuristic so single intentional uses don't trip the gate.
- **Read `references/performance.md`** — If you see complex animations, check for GPU optimization issues
- **Read `references/motion-cookbook.md`** — Reference when making specific implementation recommendations (the recommended fix code, including the per-finding demo motion in HTML mode)

---

## STEP 3: Output Format (HTML by default)

The audit produces a **self-contained HTML report** with auto-looping CSS demos beside Critical and Important findings. **Read `references/output-format.md`** for the full template (both HTML mode and terminal mode).

### Default behavior — write and open the HTML report

1. **Resolve the write location.** The file is written to `motion-audits/{project-name}-{ISO-date}.html` in the audited project's root.
   - **Audited project root**: run `git rev-parse --show-toplevel` from the agent's cwd. If it succeeds, use that path. If it fails (no `.git` ancestor), use cwd.
   - **`{project-name}`**: the `name` field from `package.json` at the project root if it exists; else the `name` field from `pyproject.toml`; else the basename of the project root. Strip any scoping prefix (`@scope/pkg` → `pkg`) and sanitize to lowercase kebab-case (`[a-z0-9-]`, replace others with `-`).
   - **`{ISO-date}`**: today's date as `YYYY-MM-DD`.
   - Example: `<project-root>/motion-audits/my-app-2026-05-20.html`.
   - Do not modify `.gitignore`. The user sees `motion-audits/` in `git status` and decides whether to ignore it.

2. **Read `references/demo-shell.html`** and use it as the template for each demo card. Embed one card per Critical + Important finding (Opportunities do not get demo cards). Use the suffixed-naming contract — `@keyframes motion-{n}-...` and `.demo-card-{n}__motion-target`, `{n}` = the finding's 1-indexed position across the whole report — so multiple findings don't collide on CSS names.

3. **Generate per-finding motion code** by reading the audited code, the relevant lens reference, and `references/motion-cookbook.md` for the recipe. Use the shell's 0% / 66% / 100% cadence at `animation-duration: 3s` (~2s motion, ~1s hold, loop). The `@keyframes` 100% state must match the motion-target's default static rendering so the shell's `prefers-reduced-motion` guard shows the correct final visual.

4. **Write the file.** Create `motion-audits/` if it doesn't exist. Write the complete self-contained HTML document.

5. **Open in the default browser** via OS-detected Bash dispatch:

   ```bash
   path="<absolute path to the HTML file>"
   if [ -n "$WSL_DISTRO_NAME" ] || grep -qi microsoft /proc/version 2>/dev/null; then
     win_path=$(wslpath -w "$path")
     cmd.exe /c start "" "$win_path" 2>/dev/null
   else
     case "$(uname -s)" in
       Darwin)               open "$path" ;;
       Linux)                xdg-open "$path" ;;
       MINGW*|MSYS*|CYGWIN*) start "" "$path" ;;
       *)                    echo "Unknown platform — open this file manually: $path" ;;
     esac
   fi
   ```

   If the open command returns non-zero or the platform is unrecognized, print `Open this file in your browser: {absolute path}` and continue. Never abort the audit because of a failed browser-open.

6. **Print the 3-line terminal summary:**

   ```
   🎬 Motion audit complete — 🔴 {N} Critical · 🟡 {N} Important · 🟢 {N} Opportunities
   📄 Report: {absolute path}
   💡 Want the full report inline instead? Re-run with --terminal or say "show inline".
   ```

### Terminal mode (flag-triggered)

When the user signals terminal mode (`--terminal` / `--inline` / `--no-html` flag, or "show the full report inline" / "skip the HTML" / "terminal only"), **skip the HTML write and the browser-open** and render the decorated-markdown report inline per `references/output-format.md` terminal mode. Do not print the 3-line summary in this case.

Do not summarize the audit content in either mode — users want full per-lens perspectives.

---

## Agent Gotchas (Self-Check Before Writing the Report)

Common failure modes during HTML report generation. Most break silently or only manifest when a second finding lands in the same report.

- **Don't reuse keyframe or class names across findings.** Each demo uses `@keyframes motion-{n}-...` and `.demo-card-{n}__motion-target` where `{n}` is the 1-indexed position across the WHOLE report. Duplicate names mean the second finding shadows the first and the first demo breaks silently.
- **Don't redefine the shell's CSS variables.** Per-finding code uses `var(--bg)`, `var(--fg)`, `var(--border)`, `var(--accent)`, `var(--loop-dim)`, `var(--sans)`, `var(--mono)`. Hard-coding colors or fonts breaks dark mode and typography consistency.
- **Don't write per-finding overrides inside the `prefers-reduced-motion` block.** The shell's guard collapses all `[class*="__motion-target"]` animations. Make the `@keyframes` 100% state match the motion-target's default static rendering instead.
- **Don't include demo cards for Opportunities.** Demos are reserved for Critical and Important. Surface Opportunities in text only.
- **Don't animate the report itself.** No entrance, scroll, or mount animations on the report chrome — only the demo cards animate. Animating the report reproduces the AI-slop patterns the audit exists to catch.
- **Don't write to cwd if `git rev-parse --show-toplevel` succeeds.** The report goes to `{project-root}/motion-audits/`. Only fall back to cwd when git returns nonzero.
- **Don't abort the audit if browser-open fails.** A non-zero exit code is a "no default handler" condition, not an error. Print the path and continue.
- **Don't modify `.gitignore`.** The skill never touches it. The user adds `motion-audits/` themselves if they want.
- **Don't summarize per-lens findings.** Each section needs its own findings + working-well items + the `Through {Designer}'s lens:` summary.

---

## Success Criteria

- [ ] Context gathered (CLAUDE.md, package.json, existing animations, structure)
- [ ] Motion gap analysis run — conditional renders checked for missing animation
- [ ] Weighting proposed and confirmed by the user
- [ ] Audit checklist worked through systematically
- [ ] Anti-checklist applied — AI-slop categories checked against the codebase
- [ ] Accessibility checked — prefers-reduced-motion verified (mandatory)
- [ ] HTML report written to `motion-audits/`, opened in browser, 3-line summary printed (or terminal-mode report rendered inline when flagged)
- [ ] Report follows output-format.md with full per-lens sections; Critical + Important findings have looping demo cards
