# Local review

Open http://localhost:3001/chat.

The current Vite process is listening on IPv6 localhost port 3001. Start a new session only after the existing process stops:

```sh
cd /Users/tannerlinsley/GitHub/tanstack.com
PORT=3001 pnpm run dev:cloudflare
```

Use the normal Google or GitHub login. Existing provider, OAuth state, account and session checks remain enabled. Local environment configuration contains the database, session secrets, both provider credential pairs, and integration encryption key. Credential values were not printed. The included model is configured in wrangler.jsonc, not .env.local.

The automated browser currently refuses this local URL with ERR_BLOCKED_BY_CLIENT. The running server alone does not prove the page or login works. Browser protections have not been changed. Real sign-in, model requests, connected integrations, browser code execution, and rendered UI still need verification.

Deployment is on hold until approval after review. Do not deploy, publish remotely, merge a change that automatically deploys, or activate production traffic.

## Install and offline review

On /chat, verify the single manifest link points to /chat/manifest.webmanifest and browser install opens /chat. Other site routes must keep /site.webmanifest. In a production build, the chat worker registers /tanchat-sw.js with /chat scope. Test offline navigation at /chat and a nested conversation. Login and API requests must never receive an offline page, and no private responses may appear in Cache Storage. Browser installation and real offline navigation have not yet been verified.
