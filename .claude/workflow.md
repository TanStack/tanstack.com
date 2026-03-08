# Workflow

## Build Commands

- `pnpm test`: Run at end of task batches
- `pnpm build`: Only for build/bundler issues or verifying production output
- `pnpm lint`: Check for code issues
- `dev` runs indefinitely in watch mode

Don't build after every change. This is a visual site; assume changes work.

## Debugging Visual Issues

When something doesn't work or look right:

1. Use Playwright MCP to view the page and debug visually
2. Use `pnpm build` only for build/bundler issues
3. Use `pnpm lint` for code issues

## Playwright Testing

Preferred method for verifying visual changes:

- Navigate to the relevant page
- Take snapshots/screenshots to verify UI
- Interact with elements to test functionality
