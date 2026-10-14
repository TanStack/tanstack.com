# TanStack desktop

This is the Electron host ported from Gum. It opens `https://tanstack.com/chat` in packaged builds and retains the native browser, folder grants, connected-device transport, and update controller.

Install dependencies from the repository root with `pnpm install`.

For development, start the website, then run:

```sh
TANSTACK_APP_URL=http://127.0.0.1:3000 pnpm dev:desktop
```

Use the origin and port of your running website. The development command installs the declared Electron binary using Electron’s own `install-electron` command. Packaged builds ignore development URL overrides.

`pnpm test:desktop` builds the native folder helper and runs the desktop tests. These also run in the repository’s normal test command.

`pnpm pack:desktop` creates a local app directory in `dist/desktop`. Electron Builder may use an available signing identity. This command does not publish an update.

For a distributable macOS build, configure `TANSTACK_UPDATE_URL` with the HTTPS update directory and provide Apple notarization credentials through `APPLE_KEYCHAIN_PROFILE`, an Apple API key, or the existing Apple ID credential variables. Run `pnpm dist:desktop`. Upload the generated artifacts and update metadata to that same directory after verifying signing and notarization. The command does not publish automatically.

The original release scripts are retained in scripts/desktop-release.mjs and scripts/desktop-publish.mjs. `pnpm verify:desktop-release` checks signing, notarization, artifacts, and update metadata without publishing. `pnpm finalize:desktop-release` can submit notarization and regenerate hashes and blockmaps. `pnpm publish:desktop-release` verifies first, then publishes to the explicitly configured TANSTACK_RELEASE_BUCKET and TANSTACK_UPDATE_URL. The update URL must expose that bucket at its configured directory. Provisioning and publishing still require release approval.
