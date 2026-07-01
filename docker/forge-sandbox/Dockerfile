# Forge sandbox image: a baked template + Codex CLI, so a forge run starts
# from an already-scaffolded, already-installed TanStack Start app instead of
# paying scaffold/install cost on every session. The container's disk is
# ephemeral (Cloudflare containers report snapshots: false), so this image
# IS the warm starting point every sandbox boots from.
#
# Pin base tag to the @cloudflare/sandbox version in package.json.
FROM docker.io/cloudflare/sandbox:0.12.1

# Codex CLI + TanStack CLI baked (native binaries are OPTIONAL deps → --include=optional).
RUN npm i -g @openai/codex @tanstack/cli --include=optional && codex --version

# The expensive part, ONCE: scaffold + install + write Intent skill mappings.
# `project-name` must be URL-friendly (no path separators) — the actual
# filesystem location is controlled by --target-dir.
RUN tanstack create app --framework react --no-examples --intent -y --target-dir /workspace/app

WORKDIR /workspace/app

# Vite preview-readiness (server.host/allowedHosts patch) is applied in Task 2.1 —
# not raw-echoed or hand-edited here.
