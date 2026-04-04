#!/usr/bin/env bash
# Close identified AI slop issues and PRs on tanstack/tanstack.com
# Run with: bash close-slop.sh
# Requires: gh CLI authenticated with repo scope

set -euo pipefail
REPO="tanstack/tanstack.com"

echo "=== Closing AI slop on $REPO ==="

# ─────────────────────────────────────────────
# ISSUE #775 — Automated spam (AccessScore promo)
# ─────────────────────────────────────────────
echo "Closing issue #775..."
gh issue close 775 -R "$REPO" -c "$(cat <<'EOF'
Closing this issue. This was filed as part of an automated campaign that mass-opened identical templated issues across 20+ major open-source repos (React, Vercel, Bun, Deno, Vite, etc.) on the same day to promote a paid accessibility scanning tool. The account's own public repo describes this as a "GitHub outreach sprint" for product promotion.

We take accessibility seriously, but this isn't a good-faith contribution — it's marketing spam. If anyone wants to open a genuine accessibility issue with specific findings (which elements, which pages, reproduction steps), we'd welcome that.
EOF
)"

# ─────────────────────────────────────────────
# PR #780 — Contribution farming (trivial 2-line change)
# ─────────────────────────────────────────────
echo "Closing PR #780..."
gh pr close 780 -R "$REPO" -c "$(cat <<'EOF'
Thanks for the contribution, but closing this. The change (wrapping text in a `<code>` tag and adding two Tailwind color classes) is cosmetic and not something we need — the existing rendering is fine.

We appreciate the effort, but the elaborate PR description with verification checklists is disproportionate to a 2-line formatting tweak and suggests this may have been AI-generated without much human review. We'd rather see contributions that address real issues.
EOF
)"

# ─────────────────────────────────────────────
# PR #728 — Sentry bot: wrong fix (GET → POST)
# ─────────────────────────────────────────────
echo "Closing PR #728..."
gh pr close 728 -R "$REPO" -c "$(cat <<'EOF'
Closing this. Changing these server functions from GET to POST doesn't address the reported error (missing `serverFnErrorMiddleware`) and is semantically incorrect — these are read-only data-fetching functions that should remain GET for cacheability.
EOF
)"

# ─────────────────────────────────────────────
# PR #724 — Sentry bot: wrong fix location
# ─────────────────────────────────────────────
echo "Closing PR #724..."
gh pr close 724 -R "$REPO" -c "$(cat <<'EOF'
Closing this. The null-safety checks are added inside the IntersectionObserver callback, but the reported crash (`ownerDocument` on null) occurs when the observer is constructed or begins observing a null element — before the callback is ever invoked. These guards don't prevent the actual error.
EOF
)"

# ─────────────────────────────────────────────
# PR #737 — Sentry bot: sledgehammer tooltip disable
# ─────────────────────────────────────────────
echo "Closing PR #737..."
gh pr close 737 -R "$REPO" -c "$(cat <<'EOF'
Closing this. Disabling tooltips entirely on touch devices is too broad a workaround — it hides the bug rather than fixing it, and `navigator.maxTouchPoints > 0` false-positives on laptops with touchscreens. The underlying null container issue should be fixed directly instead.
EOF
)"

# ─────────────────────────────────────────────
# PR #722 — Sentry bot: over-engineered SSR fix
# ─────────────────────────────────────────────
echo "Closing PR #722..."
gh pr close 722 -R "$REPO" -c "$(cat <<'EOF'
Closing this. The direction (gate portal rendering until mounted) is right, but the implementation has unnecessary complexity — `typeof window` check inside `useEffect` is redundant (effects only run in the browser), the `portalRoot` ref adds no value over passing `document.body` directly, and the cleanup `setIsMounted(false)` is pointless during unmount. We'll address the underlying tooltip SSR issue separately with a cleaner approach.
EOF
)"

# ─────────────────────────────────────────────
# PR #720 — Unused deps, fragile regex, unnecessary approach
# ─────────────────────────────────────────────
echo "Closing PR #720..."
gh pr close 720 -R "$REPO" -c "$(cat <<'EOF'
Thanks for identifying the Solid docs hook transformation issue — that's a real problem. However, closing this PR because:

1. The approach conflicts with the existing block-replacement mechanism (as Sean mentioned), which is the preferred way to handle framework-specific doc transforms.
2. Six Babel dependencies are added to `package.json` but none are actually imported or used — the implementation uses regex instead.
3. The regex (`[\s\S]*?` non-greedy) will break on nested braces, and the replacement strips code block language tags (breaking syntax highlighting).

If you'd like to contribute a fix using the block-replacement approach, we'd be happy to review that.
EOF
)"

# ─────────────────────────────────────────────
# PR #735 — Over-engineered scroll listener
# ─────────────────────────────────────────────
echo "Closing PR #735..."
gh pr close 735 -R "$REPO" -c "$(cat <<'EOF'
Thanks for working on this. Closing because the approach has performance concerns — storing `scrollY` in React state triggers a re-render on every scroll event, and calling `getComputedStyle` + `getBoundingClientRect` on each render is expensive. This would be better solved with an `IntersectionObserver` or a CSS-only z-index fix. Happy to review a revised approach if you'd like to take another pass.
EOF
)"

echo ""
echo "=== Done. Closed 8 items. ==="
echo ""
echo "Items left for manual review (not auto-closed):"
echo "  PR #731 — c15t consent banner (may be coordinated, needs maintainer decision)"
echo "  PR #747 — Sentry tooltip/dropdown fix (partially useful, needs cleanup)"
echo "  Issues #725, #726, #730 — yuvarajsai (valid bugs, just burst-filed)"
