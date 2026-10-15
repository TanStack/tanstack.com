# Sitemap failure and recovery test

Run `pnpm exec tsx scripts/prepare-sitemap-test.ts` to create isolated documentation repositories. It prints their temporary directory. The test only changes files containing its exact fixture text.

Start a local preview with that directory as `TANSTACK_LOCAL_REPOS_DIR`:

```sh
DISABLE_REDACT=true TANSTACK_LOCAL_REPOS_DIR=/path/printed/by/script pnpm exec vite dev --host 127.0.0.1 --port 4314 --strictPort
```

In another terminal, run:

```sh
TANSTACK_SITEMAP_TEST_BASE_URL=http://127.0.0.1:4314 TANSTACK_SITEMAP_TEST_REPOS=/path/printed/by/script pnpm exec tsx --test tests/sitemap-completeness.integration.test.ts
```

The preview still needs access to the published Charts catalog or its existing GitHub artifact cache. This test isolates documentation reads, not the catalog service.

The test verifies every sitemap-enabled documentation library, removes the Start fixture, restores it, corrupts its frontmatter, and restores it again. Each failure must return 503 with no-store headers and a Retry-After value. Each recovery must restore all expected document URLs. The server log identifies the failed library and records successful generation after recovery.

Stop the preview and remove the generated temporary directory when finished. The GitHub directory fallback and deep local traversal tests run with the normal `pnpm test` suite without a preview.
