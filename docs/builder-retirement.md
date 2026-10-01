# Builder retirement

TanChat replaces the standalone Builder product. `/builder` redirects to `/chat`, the Builder menu item is removed, and the esbuild experiment is retired. Existing project-specific links redirect to their TanChat equivalents.

Project APIs now live under `/api/chat`. Their callers and tests use those routes. The project interface lives under `src/chat/components/projects`.

The existing project tables remain because TanChat's saved-project tools still use them, including revisions, events, snapshots, and usage accounting. Dropping those tables would remove a working TanChat capability. No database deletion is included in this change.

Unpublished browser-sandbox integration remains disabled as documented in `deferred-browser-sandbox/README.md`.

Verification: the latest harness run passed all 226 files and 2,221 tests. The production build completed successfully. Full pre-commit verification is still being resolved before this change can be published.
