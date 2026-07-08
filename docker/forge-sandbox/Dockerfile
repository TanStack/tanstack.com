# Forge sandbox image: a baked template + Codex CLI, so a forge run starts
# from an already-scaffolded, already-installed TanStack Start app instead of
# paying scaffold/install cost on every session. The container's disk is
# ephemeral (Cloudflare containers report snapshots: false), so this image
# IS the warm starting point every sandbox boots from.
#
# Pin base tag to the @cloudflare/sandbox version in package.json.
FROM docker.io/cloudflare/sandbox:0.12.1

# Required by Cloudflare Sandbox local development so the Vite preview port is
# reachable from the tunnel process running inside the sandbox.
EXPOSE 5173

# Codex CLI + Claude Code CLI + TanStack CLI baked (native binaries are
# OPTIONAL deps → --include=optional). Both coding CLIs are present so a forge
# run can drive either BYOK provider in-sandbox: Codex for OpenAI keys
# (CODEX_API_KEY), Claude Code for Anthropic keys (ANTHROPIC_API_KEY).
RUN npm i -g @openai/codex @anthropic-ai/claude-code @tanstack/cli --include=optional \
  && codex --version \
  && claude --version

# The Forge preview setup uses pnpm when available, with npm as a runtime fallback.
RUN npm i -g pnpm && pnpm --version

# The expensive part, ONCE: scaffold + install + write Intent skill mappings.
# `project-name` must be URL-friendly (no path separators) — the actual
# filesystem location is controlled by --target-dir.
RUN tanstack create app --framework react --no-examples --intent -y --target-dir /workspace/app

# Pull package-provided Intent skills from the installed dependencies into the
# agent config that ships with the sandbox image.
RUN cd /workspace/app && npx --yes @tanstack/intent@latest install

# Vite preview-readiness: the forge preview URL hits the dev server on a
# Cloudflare-assigned host, not localhost, so Vite must bind all interfaces
# and allow that host. Runs AFTER scaffold — vite.config.ts only exists once
# the app has been created above. Idempotent by design (safe to re-run).
COPY patch-vite-config.mjs /tmp/patch-vite-config.mjs
RUN node /tmp/patch-vite-config.mjs /workspace/app/vite.config.ts

WORKDIR /workspace/app
