# TanStack consolidation

September 30, 2026. Status: source audit and implementation plan, not a completed port.

## Required outcome

TanChat lives at `tanstack.com/chat`. `chat.tanstack.com` redirects there. The native application is called TanStack and can contain more than chat. The current TanStack builder assistant is replaced by this harness. Kody remains an optional recommended integration. TanStack owns identity, authorization, infrastructure, and the release process. No old Gum account or conversation data needs to migrate. Start fresh without deleting the old deployment until the replacement is verified.

The complete harness is in scope: conversations and threads, context inheritance, forks, drafts, queues, cancellation, approvals, tool discovery, MCP authorization, Kody synchronization, model providers and gateways, Jev routing, skills, memory, saved files, workflows, schedules, usage, workspace organization, sharing policies, connected devices, native desktop capabilities, offline behavior, and the existing tests. Inventory each capability before claiming parity. Experimental capabilities stay marked as experimental.

## Source evidence

The actual destination checkout is `/Users/tannerlinsley/GitHub/tanstack.com`, not `~/GitHub/tanstack`. It has unrelated active browser-sandbox changes. Preserve those changes and coordinate with the owning sibling before editing shared files.

- `src/auth/auth.server.ts` validates signed session cookies against the user and session version, then loads effective capabilities. Reuse this service, not a second cookie or email-based identity merge.
- `src/auth/context.server.ts`, `src/utils/auth.server.ts`, and `src/utils/auth.server-helpers.ts` expose the existing authentication integration.
- `src/db/client.ts` uses request-scoped Postgres through Drizzle. `src/db/schema.ts` already contains users, sessions, OAuth accounts, builder messages, runs, and project events. The source harness uses D1 SQL and per-conversation Durable Object SQLite. These are different persistence contracts, not interchangeable bindings.
- `src/server.ts` already establishes database and host runtime contexts, observability, and scheduled work. Extend those entry points rather than replacing them with Gum's server entry.
- `wrangler.jsonc` targets TanStack account `8da95258a9c70b54c3e2b374a0079106` and includes three R2 bindings. The source harness targets personal account `144575f7380700ae3ca2076ac0168566` and requires D1, Workers AI, R2, Workflows, and three Durable Object classes.
- `src/components/ds/ui`, `src/components/Tooltip.tsx`, and `src/components/markdown` are existing UI reuse candidates. Audit behavior and accessibility before substituting them for harness primitives. Do not retain two competing implementations of the same behavior without a concrete reason.
- `src/routes/builder.tsx` is more than an assistant. It supports shared examples and a charts builder. `src/routes/builder_.*`, `src/routes/api/builder/*`, and `src/utils/builder-project-*` also support project snapshots, sharing, sync, and quarantine. Replacing the harness must not silently break examples or documentation embeds.
- The source has 184 server files and 220 component files at audit time. Bulk copying them does not establish integration or completeness.

## Architecture

Use the TanStack site router, auth, user IDs, account controls, database context, observability, and deployment pipeline. Mount the chat feature under `/chat`, with its own layout and lazy loading so marketing and docs do not download the harness.

Keep durable conversation execution and stream objects as Cloudflare Durable Objects in the TanStack account. They own execution serialization, resumable streams, cancellation, and local transcript storage. Put durable account-level chat metadata, membership, provider credentials, integration configuration, and discoverability into TanStack's Postgres/Drizzle schema. Avoid a duplicate users table or a parallel account backend. Use R2 for chat files and large results. Provision fresh resources in the TanStack account. Shared auth does not imply that every conversation request must run inside the marketing page render.

Workers AI and AI Gateway belong to the TanStack account after cutover. Keep model selection and cost attribution intact. Secrets are configured through deployment tools, never copied into source or documentation. Kody OAuth authorizes an integration attached to the TanStack user. It does not replace the site's login flow.

Native shell naming is TanStack. Its production destination is `https://tanstack.com/chat`. Audit app identifiers, updater origin, signing, deep links, native folder permissions, connected-device authorization, and release channels separately. Changing the window title is not a complete desktop port.

## Implementation sequence

1. Record the source capability inventory, current destination builder behavior, destination branch state, and sibling ownership. Freeze the standalone hosting plan. Do not deploy a proxy back to the personal Gum account as the final architecture.
2. Establish `/chat` layout and route ownership in the destination. Reuse site auth and prove signed-out, signed-in, revoked-session, and forbidden-capability behavior. Use actual TanStack user IDs from the outset.
3. Define Drizzle chat tables and implement the source persistence operations using Postgres transactions and constraints. Port SQLite-specific statements explicitly, including conditional updates, deduplication, claims, and optimistic versions. Keep Durable Object-local SQLite where execution needs it. Add no old-data import path.
4. Add the execution objects, durable streams, R2 storage, Workflows, AI, Gateway, and scheduled recovery to TanStack infrastructure and type generation. Integrate the existing server runtime and cron dispatcher. Prove bindings locally before production.
5. Port the ordinary conversation loop and its UI, including cancellation, queue state, approvals, files, threads, context rules, and truthful error status. Replace or reuse destination primitives individually. Scope chat CSS and theme state so they do not alter marketing, documentation, or the design-system pages.
6. Port remaining MCP, Kody, skills, memory, routing, models, usage, workflow, schedule, sharing, device, and desktop capabilities. Keep generic tool contracts and do not add task-specific routing.
7. Extract and reuse the builder's execution, sandbox, preview, project, and deployment capabilities through the new harness. Retire its separate assistant loop and chat state. Determine which shared-example/chart routes remain dedicated tools before redirecting `/builder`. Old private project records do not need migration, but public documentation and embedded examples still need a working route.
8. Scope all chat endpoints, links, OAuth callbacks, assets, manifests, service workers, and desktop navigation. Source root assumptions such as `/api`, `/auth`, and service-worker scope `/` cannot be transplanted unchanged. Put chat-specific APIs under `/api/chat`; reuse existing site auth routes. Chat service workers must not intercept the rest of TanStack.
9. Run destination checks and an authenticated live browser parity matrix. Release through the existing TanStack pipeline. Only then activate `/builder` and subdomain redirects. Record the deployed revision, resource ownership, rollback, and remaining experimental limitations.
10. Retire the old standalone app and obsolete branding, duplicate auth, builder harness, and unused dependencies after verified cutover. Do not delete independent example infrastructure that still has consumers.

## Verification matrix

Every capability gets source location, destination location, status, tests, and browser evidence. Completion requires all of these gates:

- `/chat` works through direct navigation, reload, deep links, and local development.
- Site sign-in is reused, including session revocation and access checks. Kody disconnect does not sign the person out of TanStack.
- Ordinary tasks use a real configured model; fixtures cannot be mistaken for production inference.
- Streams reconnect and resume, long histories tail efficiently, forks and threads retain their context semantics, and queues stop without duplicate actions.
- Approvals, files, retry behavior, and tool execution retain their security and correctness contracts.
- Integrations and skills are discoverable without requiring the person to name internal tools.
- Model and tool usage are attributed to the correct TanStack user and account. Model accuracy is an observation, not a harness pass/fail gate.
- Existing site pages, login, shared examples, and documentation embeds still work.
- Native TanStack opens Chat and its device, folder, signing, and update flows work.
- `/builder` redirect behavior is defined per route, and `chat.tanstack.com` preserves valid chat deep links without forwarding credentials.
- Cloudflare bindings, storage, secrets, gateways, and release ownership are in TanStack infrastructure. No production dependency remains on the personal Gum account.
- Required tests, type checks, build, and live smoke checks cover the deployed revision, not just the source branch.

## Open decisions to resolve from code

Builder public examples and charts must be classified before redirecting all `/builder` paths. The auth capability that grants chat access, account budget defaults, and model availability must match TanStack's existing authorization and billing design. Desktop app identity and updater changes require coordination with the Electron work. Confirm whether the user means the existing `tanstack.com` checkout or a new `tanstack` repository before any repository move. Current working assumption is the existing website checkout because it owns the requested auth, backend, and URL.

## Implementation evidence, September 30

The first destination slice adds `chat_workspaces`, `chat_memberships`, `chat_bots`, and `chat_conversations` to the shared Drizzle schema. All user references point to TanStack's existing `users` table. `/api/chat/workspace` validates the existing TanStack session, checks the existing builder/admin capability, uses the existing same-origin boundary, and opens the personal workspace in one transaction. This is not a complete `/chat` frontend or harness port yet.

Migration `0002_tanchat_account_workspace.sql` was generated and applied only to a temporary local Postgres database. Eight concurrent opens through the actual persistence function produced one personal assistant. A second user received separate records. The database rejected archiving the personal assistant and rejected a parent from another workspace. Destination TypeScript and type-aware lint passed for this slice. Production migration, full suite, frontend, execution bindings, and deployment remain pending.

The [source schema inventory](tanchat-source-schema.json) was produced by applying all 55 source migrations to in-memory SQLite and inspecting the resulting schema. It contains 71 D1 tables, including columns and foreign keys. It is an inventory, not a converted Postgres schema. Conversation Durable Object-local schemas and R2 contents need separate inventory.

## Neon decision and conversation operations

Keep TanStack's Neon Postgres for shared account data. The sponsored account is currently free. Keep Durable Objects for execution and conversation-local streams, and R2 for files. Audit Cloudflare's actual bill before attributing the reported $250 monthly total to database usage. Do not move the site's database to D1 as part of this consolidation. Evaluate Hyperdrive for connection pooling only against measured latency and consistency needs.

The destination now has validated provider policy, TanStack server functions for opening a workspace and creating conversations, and atomic bulk archiving. Bulk archive checks the complete requested set, locks both membership and conversation records, and rejects the personal assistant. Invalid or inaccessible IDs cause the entire transaction to roll back. The repeatable local Postgres check is `scripts/verify-tanchat-workspace.ts`; it requires an empty local database named `tanchat_test*`. It checks eight concurrent opens, user isolation, assistant protection, cross-workspace parents, bulk failure atomicity, duplicate IDs, and archived-item filtering. Source rendering and the full agent loop remain to port.

### Conversation and thread context port

Main conversations now have explicit mappings, rather than limiting each assistant/user pair to one conversation. Conversation lookup checks workspace membership and the conversation owner, including when a caller supplies an exact conversation ID.

Thread storage keeps the existing bounded source snapshot contract, including source epoch, digest, text excerpts and file references. Composite foreign keys require the child and parent to belong to the same assistant and user. Stored context is evidence and does not grant access to referenced files. Context reads validate the snapshot and authorize the child conversation first.

An isolated local Postgres check applied migrations 0002 through 0004 and verified main lookup with another conversation present, exact thread lookup, cross-user rejection, snapshot reads, and rejection of cross-account parent links. Typechecking passed. These migrations have not been applied to production.

Thread creation still needs the Durable Object source-message verification and idempotency protocol. No client API accepts an unverified snapshot. The complete UI, agent execution loop, integration storage, and builder replacement remain unfinished.

Thread creation now has a Neon transaction and idempotency receipts. It locks the assistant and membership, rechecks active main-conversation admission, enforces the 100-thread limit, and creates conversation, snapshot and receipt together. The internal capture dependency must be connected to the authoritative Durable Object before a browser route is exposed. Eight concurrent identical requests produced one thread in local Postgres; retries reused the receipt without recapturing, changed-message reuse failed, and threads could not act as main parents. Typechecking passed. Runtime capture wiring remains pending.

### Direct core port

All 107 existing source core modules were copied into src/chat/core. 106 are byte-for-byte identical; types.ts now references the extracted MCP contracts in core rather than server modules. The contracts themselves were copied from the source interfaces. docs/tanchat-core-port.json records source and destination hashes for review. The persistence layer now reuses the full original thread and reference schemas instead of separate subsets.

38 existing core test files passed, 560 tests. Two additional copied tests need the conversation runtime fixtures and remain under harness-tests/pending-runtime until that runtime is ported. The harness tests use Vitest, matching the source project, and run through test:chat as part of the destination test command. Like the destination's existing tests, they are excluded from the application TypeScript build. The application typecheck passed after dependency alignment.

### Streams and transcript archive

Copied conversation-events.ts and stream-append.ts unchanged into src/chat/server. Copied transcript-archive.ts with an explicit Cloudflare SqlStorage type import, and conversation-stream.ts with explicit DurableObjectState and DefaultAuthEnv types. The stream handler retains the source createStreamsHandler options and default authentication behavior, and remains internal-only, with no public route mounted. No always-allow authentication callback was added.

The existing conversation-events and transcript-archive tests were carried over. The complete runnable harness suite now passes 578 tests across 40 files. This covers event projection and archived history operations, but does not yet prove deployment bindings or live stream reconnection. Durable Object wiring and public authenticated endpoints remain pending.

### MCP transport and discovery port

Copied the existing MCP client/session transport, catalog collection and cache logic, assistant discovery middleware, assistant MCP tools, crypto helpers, and paired-discovery contract into src/chat/server. Only .ts import suffixes were removed where required by the destination TypeScript configuration. The core MCP contract exports now point to the actual ported server interfaces, avoiding duplicate declarations. Added the existing MCP catalog, session, and referenced-tool tests. All 613 runnable harness tests pass across 43 files. Account credential persistence and host wiring remain pending; this does not make a connected integration available in the destination UI yet.

### Assistant behavior and system-one loop

Copied assistant-instructions.ts, assistant-capability-guidance.ts, stored-results.ts, system-one-loop.ts, and catalog-evidence.ts from the source. Source instruction text and execution logic are retained. Kody suggestion types were extracted from the source catalog interfaces into core/kody-suggestions.ts so instruction assembly does not import unported D1 persistence. Server provenance is recorded in docs/tanchat-server-port.json.

The existing assistant-discovery, stored-results, and system-one-loop tests were carried over. The runnable harness suite passes 653 tests across 46 files. The Cloudflare adapter is pinned to the source's working 0.1.5 version; the newer adapter selected by a version range required a different TanStack AI API. Application typechecking passed. Complete runtime orchestration, credentials and provider binding remain pending.

### Provider and usage port

Copied the source provider adapters, Gateway routing, Cloudflare model compatibility, public endpoint validation, request-shape observation, provider token totals, usage cost logic, and Durable Object usage ledger. Runtime binding types are explicit; the source's global Env augmentation was not brought into the website. ProviderEnv describes the actual AI binding and Gateway settings needed by these modules.

Preserved TanStack's existing OpenAI and Anthropic dependencies, including its patched OpenAI tool continuation. Added missing Gemini, Groq, Grok and Vercel adapters at source versions. Seven existing provider and usage test files were carried over. All 764 harness tests pass across 53 files, including controlled adapter responses and ledger accounting. This does not yet prove real inference through deployed bindings. Model selection, account credential persistence and usage receipts in Neon remain to wire.

### Dependency-complete runtime port

Ported another 30 existing server modules whose dependency graphs are complete in the destination, including MCP task hosting and OAuth discovery, paired Kody inventory/discovery, Kody action and code validation, delegation tools, connection/workspace/schedule tools, context and message history, and progress/error handling. Source behavior was preserved, with only TypeScript import suffix adjustments. Standalone auth popup and development backend modules were deliberately excluded because site auth and runtime replace those boundaries.

42 additional existing test files were carried over. All 1,156 runnable harness tests pass across 95 files, and application typechecking passes. Babel parser/types were added at the source versions for existing code-contract validation. Shared-database modules, the main Conversation Durable Object, frontend components, infrastructure bindings and deployment still require porting. Passing these tests does not prove full runtime parity or cutover.

### Credential persistence boundary

Ported readCredentials, writeCredentials and updateCredentials from source auth.ts into a dedicated destination credentials module. Only persistence changed from D1 to Drizzle/Postgres. The source AES-GCM seal/unseal helpers and eight-attempt compare-and-swap protocol remain in use. Credentials reference the existing TanStack user table, and no standalone session or sign-in system was copied.

Migration 0006 was applied only to isolated local Postgres. Synthetic test credentials verified encrypted-at-rest storage, wrong-key rejection, account isolation, and preservation of two simultaneous provider edits. Existing workspace/thread/archiving checks passed in the same database. Application typechecking passed. Runtime secret provisioning and authenticated settings endpoints remain pending; no real account keys were copied or production schema changed.

### Account preferences

Adapted the source account-preferences persistence to Neon while retaining the original validation schemas, default appearance/response settings, shared optimistic revision, omitted-field preservation, no-op behavior, and timezone confirmation rules. Added server functions using existing TanStack auth and CSRF protection, taking the account ID only from the authenticated session.

Migration 0007 was verified in isolated local Postgres. Checks covered default snapshots, preserving response preferences while changing timezone, no-op revision stability, stale edit rejection, one winner among concurrent edits, and user isolation. The database test caught and corrected an extra userId in a returned snapshot. Application typechecking passed. Preferences are not wired to the new UI yet, and production remains unchanged.

### Conversation memory persistence

Adapted source memory.ts from D1 guarded batches to Neon transactions. Retained the source command/list schemas, conversation-only scope, provenance, idempotency digest and historical receipts, no reuse of deleted memory identities, revision checks, expiry filtering, recall defaults, and archived/deleted access distinctions. Transactions lock the conversation, assistant and membership before mutations, and thread lifecycle records where present. Copied assistant-memory-tools.ts with only its database constructor dependency removed.

Migration 0008 was verified in isolated local Postgres. Checks include eight concurrent identical creates, replay conflicts, cross-user denial, stale updates, delete/read behavior, deleted-ID reuse rejection, expired create rejection, recall preference revisions and archived-chat write rejection. Existing credential/preferences/thread/workspace checks passed in the same database. Application typechecking passed. No public memory API or conversation runtime is wired yet, and production is unchanged.

### Composer drafts

Adapted the source composer-drafts.ts persistence to Neon, preserving person/scope ownership, optimistic revisions, empty-value tombstones, no-store responses and stale-write rejection. Added /api/chat/draft using existing TanStack session/capability checks, same-origin mutation validation, bounded JSON body reading and validation errors. The route was registered with the router generator.

Migration 0009 was tested only in isolated Postgres. Two concurrent initial writes produced one winner, clearing a draft retained its revision, stale text could not resurrect the cleared value, and another user saw a separate empty draft. The existing workspace/thread/credential/preferences/memory checks also passed. Live route authentication and frontend draft synchronization remain pending, as do the larger runtime/UI cutover requirements.

### Conversation-local storage and supporting runtime

Copied 17 existing conversation-local SQLite modules, including execution sessions, run state, schedules, delegation admission and waits, workflow state, saved results, ordered history, MCP sessions and conversation copy storage. These retain Durable Object storage and original behavior, with explicit Cloudflare type imports where the website requires them. Existing SQLite fixtures and tests were carried over.

Also copied assistant schedule policy, conversation run projection, history tools and workflow input handling with their existing tests. The source provenance manifest now covers 79 server modules, including adapted persistence boundaries. Application typechecking passes and all 1,324 harness tests pass across 110 files. These are module-level checks, not evidence of complete live runtime or UI parity. Main Conversation Durable Object wiring, shared persistence still missing from the inventory, frontend, infrastructure and deployment remain required.

### Saved-file contract preparation

Extracted the existing saved-file validation and record contract from source saved-files.ts into saved-file-contract.ts, with the original service importing and re-exporting it. Copied that module unchanged into the destination. No validation or file behavior was rewritten. Source saved-files and draft-files suites passed all 63 tests after extraction.

The remaining persistence port must retain quota reservation, immutable R2 payloads, checksum verification, pending receipts with resumable identical retries, current-access checks before publication, draft attachment and copy/import provenance. The shared contract alone does not provide destination file persistence or connected file tools.

### Saved-file Neon schema

Added chat_file_drafts, chat_bot_drafts, chat_saved_files and chat_saved_file_imports to the shared schema and generated migration 0010. Composite foreign keys bind conversation files and first-send receipts to their actual bot/account/workspace. Draft and conversation scope are mutually exclusive. File size, name, digest, source and state have database constraints. Import provenance does not reference the source file with a cascading foreign key, preserving independent completed copies.

Ported the source immutable-file and import-receipt triggers to Postgres. Draft promotion requires a matching first-send receipt, current active conversation/membership, ready selected attachments, and conversation quota. It locks the conversation, bot and membership while checking promotion. Metadata cannot change and ready state cannot revert.

The full migration chain through 0010 passed in a fresh isolated local database. Checks covered invalid cross-account file scope, metadata/import immutability, unauthorized promotion rejection, authorized promotion, rejection of a second scope move, and monotonic ready state. Existing workspace, thread, credential, preference, memory and draft checks passed too. Application typechecking passed. The local database server was stopped. No production migration was applied. File service persistence and R2 publication still need wiring and concurrency verification before this can be used by the destination runtime.

### Saved-file service port, first transaction boundary

Ported the FileStore save/list/get/content/text paging behavior to Neon. Scope authorization and quota reservation share a Postgres transaction that locks the conversation, bot, membership and existing thread lifecycle. Pending receipts count against quota. Publication rechecks authorization and receipt ownership after immutable R2 upload/checksum verification. Normal saves cannot adopt import-reserved IDs. Repeated identical saves resume pending uploads, different bytes or metadata fail, and account access is checked on reads.

Copied the original verified-byte reader and same-conversation copy method, retaining abort handling and source rechecks before and after delivery intent. R2 native conditional options replace the equivalent If-None-Match header, and native arrayBuffer replaces DOM Response construction to avoid incompatible Worker/DOM type declarations. The copied byte allocation has an explicit ArrayBuffer generic.

Fresh isolated Postgres checks passed for eight concurrent identical uploads, one immutable payload, changed-content rejection, failed-upload receipt recovery, account isolation, text paging, verified copy and same-ID rejection. Existing migration and persistence checks also passed. Application typechecking passed after the buffer type adjustment. The local database was stopped. Cross-conversation import, draft upload/promotion services, file APIs and assistant file tools remain to port, so this is not complete file-runtime parity. No production deployment or migration occurred.

### Cross-conversation imports and draft file service

Ported cross-conversation file imports to Neon transactions while retaining exact source bindings, frozen metadata, abort handling, verified bytes, import quotas, rejection of ordinary saves into reserved import IDs, and independently owned completed copies. Every file transaction takes the account/workspace membership lock before conversation locks, so reciprocal imports use consistent ordering. Access is checked again at reservation and publication. A completed import can be replayed after source deletion; a new import cannot use the deleted source.

Ported DraftFiles and resolveDraftAttachments with original limits and read-only empty draft behavior. Replaced D1 promotion statements with promoteDraftFiles, called inside the caller's first-send transaction. Existing database triggers enforce the receipt, selected attachment readiness, authorized scope transition and quota. Every staged file moves, including unfinished uploads that remain resumable in the destination conversation.

Copied assistant-file-tools.ts byte-for-byte and carried over its 22 existing tests. Added the website source alias to the harness test configuration. All 1,346 harness tests pass across 111 files. Application typechecking and targeted lint pass.

Fresh isolated Postgres checks passed for concurrent import idempotency, source-binding conflicts, failed-import recovery, reserved-ID protection, completed-copy independence, reciprocal imports, read-only empty drafts, pending attachment rejection, promotion of ready and pending files, sent-draft denial, resume after promotion, and the 20-unsent-draft limit under 22 concurrent uploads. Existing persistence checks passed as well. The first import test run had an invalid synthetic integer timestamp, corrected to now(); the corrected full check passed. No production schema or deployment changed. File routes and first-send runtime integration remain pending, as does the main conversation runtime/UI/infrastructure cutover.

### Authenticated file HTTP boundary

Ported file-api.ts with the original bounded upload reader, metadata/content behavior, media type handling, private no-store headers, safe attachment filenames, text preview restriction and sandbox headers. Copied its seven existing tests. The FileEnvironment runtime boundary now uses native readable streams, consistent with the site's existing blob-storage boundary, instead of importing Cloudflare's conflicting stream declaration into DOM Response construction.

Added /api/chat/files with existing TanStack session/capability checks and same-origin PUT validation. The route takes the account ID only from the authenticated session. Query validation requires a workspace and either draft scope or a bot/conversation scope, rejects mixed scopes, and requires valid UUIDs for file operations. File-service errors return their actual status. The route was registered using the installed router generator.

getFileEnvironment reuses the existing BUILDER_PROJECTS R2 binding, tanstack-notebook-projects, with immutable saved-files/ keys. Existing builder snapshots use projects/v1/ keys, so no builder storage behavior or existing keys changed. Missing runtime storage returns 503 rather than silently substituting local data. This reuse does not create a new bucket or incur a separate provisioning requirement.

Seven route checks verify missing sessions, capability denial, session-derived ownership despite a forged query user ID, cross-origin uploads, invalid/mixed scopes and storage failures. All 1,360 harness tests pass across 113 files. Application typechecking and targeted lint passed. Live authenticated HTTP access and deployed R2 reads remain unverified. The frontend, first-send flow, full conversation runtime, deployment and builder replacement remain pending. No production changes were made.

### First-send receipt and atomic creation boundary

Added the original draft receipt fields for first message text, parent, model selection, references and started state, plus the source's unique bot-to-first-send receipt constraint. Migrations 0011 and 0012 remain local.

Ported the persistence portion of source BotDrafts.start into BotDrafts.reserve. It reuses botDraftInput, draftBotName, model/reference schemas and replay comparisons. A transaction locks membership, rechecks a winning receipt, validates an active same-workspace parent, checks selected files under the same transaction, inserts the bot/conversation/main mapping/receipt and promotes all staged files. A rejected request cannot leave an orphan chat. Replay returns the frozen receipt without rerunning preparation. The internal prepare dependency must be connected to the original model/reference/attachment validation before this is exposed publicly. Runtime begin and started-state acknowledgement are not implemented by this reserve method.

The full migration chain through 0012 passed in a fresh isolated local database. Eight concurrent first sends produced one chat; eight first sends with the same attachment produced one chat and one scope promotion. Checks also covered changed-input rejection, no preparation on replay, foreign-parent and account denial, and no orphan chat/receipt for a pending selected attachment. Existing persistence/import/draft checks passed. Application typechecking and targeted lint passed. The local database was stopped. Actual model execution, first-send API/UI, complete runtime wiring and production cutover remain pending.

### Original model resolution and attachment preparation

Copied run-models.ts, model-attachments.ts and attachment-request.ts. Model catalog contents, configured-provider resolution, workspace policy enforcement, endpoint validation, reviewed reasoning levels, vision/PDF support, attachment budgets, saved snapshot checks and provider message preparation remain the original code. Changed the credential import from standalone auth to the ported shared-account credentials module and replaced the standalone Env type with explicit ModelEnvironment/AttachmentEnvironment dependencies.

Copied the original run-model and model-attachment test suites, changing their credential mock path to the new persistence module. All 1,409 harness tests pass across 115 files and application typechecking passed. These checks exercise deterministic harness behavior with controlled responses, not model efficacy. Actual inference, shared-runtime secret provisioning, model API/UI and integration into first-send preparation remain pending.

### Authenticated model catalog and policy reuse

Added /api/chat/models, registered through the router generator, using the existing TanStack session and builder/admin capability. The catalog takes account identity from the session and reads policy only through that account's workspace membership. The endpoint always uses real-model mode, never a client-selected fixture mode. Responses contain model selection metadata only, with private no-store caching.

ModelEnvironment reads INCLUDED_MODEL and ENCRYPTION_KEY from the shared runtime environment or the site's local process environment. Missing configuration produces an explicit 503; no keys or model defaults were invented and no production secrets were provisioned. Replaced the initial duplicate chat policy definition with re-exports of the original core policy schema/default/type, retaining one authoritative policy definition.

Six route checks cover authentication, capability, workspace selection, session-derived identity, forced real-model mode, inaccessible workspaces before credential lookup, secret isolation and missing configuration. All 1,415 harness tests pass across 116 files. Application typechecking and targeted lint passed. Actual workspace policy reads and cross-account denial passed in fresh isolated Postgres along with the full persistence checks; the local database was stopped afterward. Live model catalog access, secret provisioning, real inference, frontend, main Durable Object runtime and production cutover remain pending.

### Private skill persistence

Ported source skills.ts to Neon transactions and added chat_skills, chat_skill_versions and chat_skill_commands in local migration 0013. Original validation schemas, cursor decoding/filter binding, metadata-only listing, canonical request/content hashing, pinned version inspection, archive/restore/enable behavior and historical command receipts are retained. Membership locks serialize scoped writes and quota checks. Postgres transactions replace the D1 nonce/guarded-batch protocol. Global ID collisions return a conflict rather than adopting another account's record.

The complete migration chain through 0013 passed in fresh isolated Postgres. Checks covered eight identical creates, changed-command replay rejection, version history and old receipt replay after update, stale revisions, archived edit/resolve rejection, restore remaining disabled, re-enabled pinned-version resolution, private scope, metadata pagination and filter-bound cursors. The 200-skill limit includes archived skills. A test-only version-write failure rolled back the skill and command receipt, and retry after removing the failure succeeded. This injection existed only in the isolated test database.

Application typechecking and targeted lint passed. The local database was stopped. Combined local/Kody skill catalog, selected-skill preparation, skill tools/API/UI and the main runtime remain to wire. No production schema, skill content or deployment changed.

Kody token renewal now uses Neon refresh claims. This is a direct port of the source renewal protocol, including the rule that an expired lease cannot consume the same refresh token again. Migration 0014 is local only. OAuth account linking and the combined skill catalog still need wiring and live verification.

Isolated Postgres verification passed for Kody renewal: eight concurrent callers made one refresh request, all received rotated credentials, stale readers could not reuse an expired refresh lease, rejected grants were not retried, and sign-in status reflected the saved rejection. Test transport responses were simulated, so this does not prove live Kody OAuth connectivity. Verification: scripts/verify-tanchat-kody-refresh.ts.

Ported Kody account discovery and memory search from source, retaining bounded projections and request timeouts. Workspace authorization now uses the existing shared policy reader. Seven original projection tests and isolated Postgres membership/disconnected-account checks passed. No live OAuth or frontend wiring is implied.

Ported Kody reference account checks, run inspection, bounded resource projections, and fresh MCP handshake guidance. Account subjects are now represented in local migration 0015, attached to existing TanStack users. These modules retain the source account-change recheck after remote reads. OAuth link creation, catalog synchronization, and runtime/UI integration remain incomplete.

Catalog synchronization prerequisites now include Neon account-bound snapshots, historical skill versions, revision leases, and staging rows in migration 0016. The source catalog fingerprint protocol is ported in kody-skill-account.ts, including membership, policy, connected subject, and fallback token binding. The actual collector and atomic sync publication are still pending, these prerequisites do not constitute a functioning synchronized catalog.

The original Kody skill collector is ported into kody-skill-source.ts, preserving inventory validation, paired list/get exports, bounded pages, stable index fingerprints, companion files, and three-registry concurrency. Three checks using the original catalog fixtures passed, including rejection of inconsistent page counts and foreign-package documents. Typechecking and lint passed. Atomic Neon publication and catalog readers remain pending.

Ported source catalog synchronization to direct Postgres queries and atomic publication. Isolated Postgres verified snapshot publication, preserved companion files, fresh-cache lease exclusion, and staging cleanup using original collector fixtures. Typechecking and lint passed. Failure rollback, competing revision takeover, catalog readers, and live integration remain to verify or implement.

Ported catalog readers and original skill ranking. Isolated Postgres checks passed for ready cache reads, pinned inspection, companion file retrieval, ranked suggestions without new remote calls, and preserving the previously published snapshot after collector failure. Typechecking and lint passed. Combined local/Kody catalog, OAuth account linking, main runtime, UI, and live cutover remain incomplete.

The combined catalog requires private installed plugins as well as saved and Kody skills. Ported the source plugin schema to local migration 0017, retaining immutable-version storage, package files, stable skill identities, MCP bindings, and command receipts. Source plugin scope/error/version-pin contracts are ported in plugin-contract.ts. The plugin service and combined catalog are still pending, no plugin namespace has been dropped as a shortcut.

Ported private plugin package reads and original package validation into plugin-packages.ts, including retained-version metadata authorization, supported-component checks, file reads, and repeated membership checks. Typechecking and targeted lint passed. These read paths still require Postgres behavior checks. Installation commands, plugin skill listing, MCP bindings, combined catalog and main harness wiring remain pending.

Isolated Postgres checks passed for plugin package validation, private account reads, retained-version inspection, file retrieval, and denial after disabling/removing an installation. Plugin skill inspection and exact-version resolution are now ported from source, with typechecking and lint passing. Skill-specific Postgres checks, listing, install/update commands, and combined catalog wiring remain pending.

Plugin skill listing now retains original version-pin and cursor behavior. Isolated Postgres checks passed for skill inspection/resolution, listing, exact pins, missing-version denial, and disabled omission/use denial. The original three-namespace SkillCatalog is ported, with constructor/storage imports adapted. Combined pagination behavioral verification, plugin commands/MCP bindings, assistant tool wiring and main runtime remain pending.

Original assistant skill tool definitions now use the ported three-namespace catalog. Isolated Postgres checks verified single-item pagination through private/plugin/Kody skills, external-only listing, exact plugin resolution, actual read_skill execution and its onRead task-pin callback. Typechecking and targeted lint passed. Tool registration in the main Conversation runtime, browser skill UI, plugin write lifecycle and live deployment remain incomplete.

The original bounded skill HTTP adapter is ported and registered at /api/chat/skills behind existing TanStack authentication, builder/admin capability, workspace membership, and same-origin mutation checks. Four route boundary tests passed, along with typechecking and targeted lint. This does not verify a live deployed endpoint or browser UI. Main runtime/UI, plugin writes, OAuth setup and deployment remain pending.

MCP account storage prerequisites are now ported in local migration 0018, including private accounts, encrypted secret envelopes, OAuth grant/token revisions, refresh claim fencing, and command receipts. Original account scope/error/OAuth/refresh result contracts are ported in mcp-account-contract.ts. The source legacy account importer is intentionally outside this fresh-start consolidation, no existing private data migration is requested. Actual account read/write/refresh services and OAuth setup remain pending.

Ported MCP account reads with original encrypted envelope identity checks and post-read grant/token/revision fences. Isolated Postgres verified private metadata, credential decryption, configured/runtime server projection, foreign membership denial and reconnect-state omission. Typechecking and lint passed. Account mutation/refresh/OAuth setup, plugin bindings, main runtime/UI and deployment remain pending.

Ported original MCP save/enable/disconnect/remove and OAuth-begin mutation calculations to Neon transactions. Per-user locks protect account-wide command replay and quota, transaction-local membership/policy locks preserve access. Isolated Postgres checks passed for eight concurrent identical commands, changed-command rejection, enablement revision updates and stale revision denial. OAuth token installation/refresh and live setup remain pending.

MCP OAuth completion and refresh storage are ported from source. Isolated Postgres checks passed for duplicate callback replay, eight concurrent refresh contenders with one owner, rotated token publication, completion replay and stale-claim denial. Typechecking and lint passed. Live OAuth network/setup endpoints, plugin mutation/bindings and full main runtime/UI remain incomplete.

Ported original MCP account runtime refresh/check flow and trusted public egress selection. Ten original egress tests passed, targeted lint/type analysis passed after adapting optional environment fields. The original build-time local-development assertion is retained, but Vite companion wiring remains pending, so local remote requests fail closed unless an explicit companion is configured. Live OAuth refresh, setup endpoints, plugin writes and main runtime/UI remain incomplete.

Ported plugin install/update/enable/remove/restore/bind command calculations to Neon transactions, retaining package digest review, stable skill identities, immutable versions, exact binding endpoint validation and command replay. Isolated Postgres verified eight concurrent installs, replay conflicts, updates retaining skill identities, old file versions, remove/restore disabled state. Typechecking and lint passed. Binding concurrency, write-failure rollback, plugin quota and HTTP/runtime integration still need verification or wiring.

Ported plugin installation listing, metadata-only skill discovery, original task version-pin authorization, assistant plugin tools, and bounded plugin HTTP adapter. Postgres checks verified installation search and skill metadata alongside the prior lifecycle suite. Typechecking and type-aware lint passed. The HTTP adapter is not yet registered on an authenticated route, and tools are not yet registered in the main Conversation runtime. Full runtime/UI, OAuth setup and deployment remain incomplete.

Registered /api/chat/plugins through existing site authentication/capabilities, workspace membership and same-origin mutation checks. Four route tests and three optional-Kody environment checks passed. Fixed optional-Kody environment projection to retain configured encryption keys for independent integrations. Isolated Postgres failure injection verified that a failed plugin version write leaves neither installation nor command receipt, and the same command can subsequently succeed. Typechecking and targeted lint passed. Browser/main runtime and production cutover remain pending.

### MCP setup source port

Ported Gum's `src/server/mcp-setup.ts` directly into `src/chat/server/mcp-setup.ts`. Replaced its D1 queries with scoped PostgreSQL queries and reused the existing Neon workspace policy service. The source OAuth state, encrypted envelope, browser nonce, issuer verification, reviewed scope checks, single-use callback claim, account revision checks, and failure cleanup remain intact. Migration 0019 stores these setup attempts. Targeted lint passed. The original SQLite-backed integration tests still need adaptation to the actual PostgreSQL service before this port is considered verified. No production migration or deployment has been performed.

MCP setup PostgreSQL verification now passes in an isolated local database: published review, identical replay, conflicting request rejection, account isolation, mismatched origin denial, initialize-only public MCP connection completion, completed setup replay, and expiration. The combined workspace/service verifier also passed. These tests use a synthetic MCP endpoint, no external account or production storage. OAuth callback and concurrent setup limit cases still need coverage, and routes are not mounted yet.

Ported the original MCP account/setup API adapter and OAuth callback handler into `src/chat/server/mcp-account-api.ts`, preserving bounded request bodies and error responses. OAuth callback lookup uses Neon and existing TanStack sessions, including the site's chat capability gate. Added an MCP runtime environment loader that keeps public egress enforcement intact. These handlers still need route mounting and route tests, they are not exposed in production.

Mounted `/api/chat/mcp/*`, `/auth/mcp/callback`, and the public OAuth client metadata endpoint. The API uses existing session identity and chat capability access, checks workspace membership, rejects cross-origin mutations, and translates bounded-input validation errors. Four route authorization tests passed. OAuth returns now point into `/chat/w/...`, the eventual mounted chat UI. Production deployment and end-to-end OAuth remain unverified.

Setup publication now locks the account row and rechecks replay and the 20-attempt quota in the same PostgreSQL transaction. A 24-request parallel test verified the cap without blocking network discovery inside the transaction. The combined PostgreSQL verifier passed. Source hashes for MCP setup and API ports are recorded in the server provenance manifest.

Ported original workflow file-input reader, virtual input result store, task skill version activation, browser execution gate, and Kody assistant discovery. The workflow and discovery modules remain byte-identical; task skills and browser gate only adapt environment types. Four original test files passed, 14 tests cover predecessor file identity/access checks, read-only virtual references, browser execution restrictions, and independent cached skill/action discovery. The conversation runtime itself is still not mounted.

Ported Kody run-history projection and assistant tool with original tests, five checks passed. Ported answer evidence selection with the source ai-typesafe 0.1.1 adapter, seven original checks passed. Ported message attachment resolution, adapting only the file environment type. These are conversation runtime dependencies, the main runtime remains outstanding.

Ported original discovery-model interpretation, Jev routing, tool proposal/ranking, research loop, and Kody system-one answer execution. Only environment types were adapted. Original discovery schema, ranking, and routing tests passed, 28 checks total. No live model calls were made by these tests. The full conversation Durable Object, frontend, and infrastructure cutover are still required.

Ported Kody memory reads, reviewed memory creation, assistant memory tools, synced skill lookup, and the Jev task decision dependency tree. Adaptations are explicit environment types and extensionless imports for the destination TypeScript configuration. Four original Kody test files passed (15 checks), and the original task decision suite passed (13 checks). Type checking passed. No live remote writes or model calls occurred. Main Conversation runtime and UI remain outstanding.

Ported connected MCP server projection, plugin-bound connection lookup, and Kody setup readiness from source. Workspace policy and plugin metadata SQL now use Neon. Plugin lookup retains pinned versions, endpoint matching, credential metadata, and its post-hash access recheck. Three original setup readiness checks passed. The adapted plugin SQL and full connection composition still need PostgreSQL integration verification before considered verified.

Plugin connection PostgreSQL integration now passes: package installation and binding through actual command services, exact alias lookup, unavailable pinned-version exclusion, foreign-account denial, combined MCP projection, and disabled-package denial. The full isolated workspace/service verifier passed. No remote requests or production writes were needed for this metadata test.

Ported workflow execution context and owner authority from source. Context joins now use Neon, including current membership, active bot/thread, same-bot child access, and policy recheck after model lookup. Type checking passed. The isolated PostgreSQL verifier passed a real included-model configuration lookup, foreign-account denial, and unrelated-child denial. Full workflow dispatch and authority journal integration remain unverified until the Conversation runtime is mounted.

Ported the complete original discovery-integrations directory unchanged. Its explicit MCP integration registry, Kody inventory projection, discovery response interpretation, and action contract parsing are preserved. Three original suites passed, 33 checks total. These checks verify parsing and behavior with synthetic responses, not live Kody availability. The remaining runtime dependencies include conversation lifecycle/copies, execution authority, activity/sync, workflows, device access, and message references before the main Conversation port can be completed.

Ported source workflow definition persistence to Neon with scoped reads, bounded latest-revision pagination, immutable revision/retry receipts, and serialized competing writers. Migration 0020 preserves the source database authority, sequential revision, and update immutability guards. The service and migration still require PostgreSQL integration verification, no production migration has been applied.

Workflow PostgreSQL verification passed: eight concurrent identical commands return one revision receipt, conflicting inputs fail, prior revisions remain readable, stale edits fail, archive produces the next immutable revision, foreign accounts cannot read, direct updates fail, and skipped revision inserts fail. Fixed a PostgreSQL ORDER BY ambiguity found by the retained-revision check. The combined service verifier passed; no production migration applied.

Ported the original assistant workflow tools. Adapted the Workflows constructor to shared persistence and declared an explicit runtime interface for the Conversation RPC methods. Type checking and three boundary checks passed: non-user tasks receive no tools, task identity gates writes/launch, and repeated definitions use identical workflow/command identities without starting a runtime. Full original runtime integration tests remain dependent on the main Conversation port.

Ported exact workflow child publication and admission storage (migration 0021). PostgreSQL verification passed eight concurrent identical publications with one child receipt, conflicting admission rejection, and foreign owner denial. Corrected timestamp serialization for the shared PostgreSQL driver. Full workflow dispatch still requires Conversation and platform workflow integration. No production migration applied.

Ported the source BotActivityOutbox and activity read/mark services to Neon. Migration 0022 stores conversation activity. DO-local latest-value outbox persistence, conditional stale-delivery rejection, exact conversation/main-chat scope checks, and monotonic read versions are preserved. PostgreSQL and outbox runtime integration tests still need to run; no production migration was applied. Execution authority remains dependent on copy and lifecycle schema ports.

Activity integration verification passed using actual local SQLite outbox statements and PostgreSQL storage: publication/drain, stale event rejection, account-isolated reads, foreign read-marker denial, monotonic read versions, and event-version clamping. The combined service verifier passed. This is not a deployed Durable Object runtime test, which remains required with the main Conversation integration.

Ported bot/thread schedule generation storage and membership generation storage in migration 0023, preserving source archive/delete and membership insert/delete/change triggers. Adapted schedule generation reads to Neon and retained the original DO-local monotonic generation markers. PostgreSQL trigger verification remains pending. Execution authority still needs copy receipt storage before its full snapshot query can be ported without dropping checks.

Lifecycle PostgreSQL checks passed: bot archive advances once, repeated archived updates do not advance, restore retains generation, thread archive advances and restore retains its marker, membership removal and rejoin advance twice. The complete local service verifier passed. These generations still need wiring into the ported Conversation runtime and execution authority.

Added source conversation-copy metadata storage in migration 0024, including private idempotency, unique target identities, phase/status checks, manifests, and retry progress. Ported the full execution-authority snapshot to Neon, retaining exact conversation/account/workspace identity, lifecycle/membership epochs, copy-ready ownership checks, and inactive-chat denial. Copy service state transitions and retry linking remain to port. PostgreSQL execution-authority tests are still pending, no production migration applied.

Execution authority PostgreSQL verification passed: exact identity and current membership epochs, inactive-chat denial and explicitly allowed inspection, pending-copy denial, ready-copy acceptance, and mismatched copy-owner denial. The combined local verifier passed.

Ported the original connected-device service to Neon, preserving folder grants, private personal conversation restriction, credential revocation, atomic operation claiming, expiry, and no automatic replay. Device schema and integration checks are pending. No production changes applied.

Connected-device PostgreSQL verification passed: private registration/listing, presence and folder grants, eight concurrent polls claiming exactly once, result delivery without replay, foreign revocation denial, and owner revocation cancelling pending operations. Full type checking passed and the combined local service verifier passed. Migration 0025 is local only; device routes and desktop client integration still need wiring.

Ported source run admission and funded usage accounting to Neon in migration 0026. PostgreSQL transaction locks replace the source atomic D1 batch, serializing per-run receipts and same-day budget admission/settlement. Original policy limits, development exemption, server-resolved unlimited entitlement, scheduled allowance, reservation, and reconciliation rules are retained. Isolated PostgreSQL checks passed concurrent idempotency, request conflict, cross-day replay, turn/scheduled limits, unlimited entitlement, funded cap denial, and monotonic unknown-cost settlement. The combined verifier passed. Runtime wiring and production migration remain pending.

Ported the full source ConversationThreads service and assistant thread tools. Migration 0027 retains request digests for delegated/manual replay. Replaced the earlier partial creation service with the original full implementation. PostgreSQL admission locks the parent and membership, checks the thread quota, and atomically stores conversation, source, and receipt. Type checking passed. Full service verification passed concurrent creation, frozen-source replay, title extraction, account-isolated context, main-parent restriction, versioned rename, archive reservation/release, empty-thread filtering, restore, and delegated receipt binding. Reservation/source RPCs are simulated in this database test; real Conversation runtime integration remains pending. No production migration applied.

Ported the original conversation copy RPC contracts and resumable worker from conversation-copies.ts, separating worker and admission storage. Worker export, page digest/bounds checks, import verification, progress fences, retry backoff, and cleanup are retained. PostgreSQL publication locks the copy, source account/membership, and parent, then atomically publishes bot/conversation/main mapping and ready status. Type checking and isolated PostgreSQL integration passed, including concurrent publication, corrupt-page failure without publication, and private transient backoff. Fixed an ambiguous PostgreSQL sort column found by the test. RPCs are simulated here; actual DO export/import and copy admission/retry service ports remain required. No production changes applied.

Ported original ConversationCopies admission, status, and source provenance service. PostgreSQL admission retains durable wake registration before publication, expiry deadline, exact source/parent checks, and idempotent command binding. Migration 0028 adds retry records, copy retry linking, uniqueness, and the original identity immutability triggers. Combined PostgreSQL integration passed concurrent copy receipt creation, private reads, conflicting requests, default fork parenting, foreign parent denial, and retry immutability. Real runtime source provenance, export/import, and retry preparation remain unverified. No production migration applied.

Ported the original copyRetrySource verifier and retry row contract to Neon. It checks exact saved copy/retry account and source identity, boundary equality, request/evidence digest, and inherited review commitment without accepting retry input from the caller. Type checking passed. PostgreSQL tests passed valid immutable retrieval, absent retry, foreign account denial, boundary tampering, evidence tampering, and review commitment tampering. Full retry preparation still depends on message-reference and Conversation runtime ports; no production changes applied.

Ported the original Kody account-object reference catalog to Neon, migration 0029. Source projection, bounds, account fingerprint checks, selected-object resolution/inspection, and revision-fenced publication are retained. Type checking and PostgreSQL tests passed publication/search/resolve/inspection, foreign account denial, stale competing refresh rejection, and account-change cache exclusion. Tests use synthetic Kody account responses, no live network call or production migration. Capability catalog and generic tool catalog remain prerequisites for the full message-reference port.

Ported the full original generic MCP tool-reference catalog to Neon, migration 0030. Retained local configuration fingerprints, bounded catalog projection, exact reference resolution, fresh/stale display metadata, refresh checks, retention pruning, and guarded publication. PostgreSQL uses a serializable transaction for prune/publication. Restored the original ensureLegacy credential-list import dependency on McpAccounts rather than bypassing it. Combined database checks passed catalog refresh/search/resolve, private account denial, incomplete catalog rejection, and disabled connection exclusion. Legacy import, competing refresh, and full runtime integration still need direct verification. No production migration applied.

Ported the full original Kody capability reference catalog to Neon, migration 0031. Original inventory collection, bounded staged publication, account fingerprint and policy checks, revision fencing, unchanged-inventory reuse, and secret projection are retained. Type checking and the combined PostgreSQL verifier passed, including capability search and exact resolution, unchanged publication reuse, foreign account denial, and exclusion of synthetic secrets from persisted items. Network responses were synthetic, and no production migration was applied. Full message-reference and Conversation runtime wiring remain required.

Ported the full original message-reference service, including catalog composition, selected file/skill/plugin/connection resolution, private conversation discovery, related-thread tools, and transcript cursor validation. Seven source D1 query boundaries now use native PostgreSQL queries, retaining original access checks and millisecond metadata contracts. Source runtime access is an explicit referenceContext RPC interface. Type checking passed. Combined PostgreSQL verification passed metadata discovery and picker resolution, self exclusion, foreign account denial, archive filtering, deleted-source rejection, file metadata, and no transcript RPC during discovery. Actual transcript paging and remaining composite selections still require runtime integration verification. No production migration or deployment occurred.

Ported the full original ConversationRetries preparation/status service. Reuses the immutable retry-source verifier already ported from the same source. PostgreSQL receipts retain JSON evidence/file plans, account scope, request identity, status fences, and destination lifecycle checks. Admission serializes per-account quota decisions and locks current source/membership rows. An explicit combined Conversation RPC interface retains capture and preparation snapshot behavior. Type checking and combined PostgreSQL verification passed eight concurrent identical requests producing one retry/copy, frozen replay, request conflict, foreign reads, readiness and draft publication, inert status reads, explicit submission/reset handling, archived-target denial, and failed-copy propagation. Runtime RPCs were simulated, file-transfer recovery and real Conversation integration remain unverified. No production changes applied.

Ported original Kody background account synchronization to Neon, migration 0032. The original remote account-index code, probe cadence, account fingerprint, revision claim, shared inventory requests, and best-effort catalog synchronization are retained. Native PostgreSQL transactions replace D1 batches for guarded publication and atomic catalog invalidation. Type checking and combined PostgreSQL verification passed concurrent probe suppression, changed-index invalidation, unchanged-cache retention, superseded response rejection, foreign account exclusion, failed-probe recovery, and explicit action invalidation. Remote index responses were synthetic. Boot/background scheduling and real account synchronization remain to wire and verify with the Conversation/application runtime. No production migration applied.

Ported source sidebar organization and workspace sync storage in migration 0033: merged bot metadata fields, private viewer pin/section/order/tags, sections/sort override, workspace source/published revision clock, and membership sync generations. PostgreSQL triggers preserve committed dirty revisions for bots, viewer state, sections, main mappings, and activity; membership removal/rejoin rotates generations. Section assignment guards retain workspace and viewer ownership checks. Combined PostgreSQL verification passed initialization, sidebar/metadata dirty revisions, foreign-section denial, removal clearing assignments, and membership generation rotation. Publisher/projection service, full BotWorkspace commands, and UI wiring remain to port. No production migration applied.

Ported source workspace-sync membership and projection reads into workspace-sync-projection.ts. Native Drizzle reads replace the D1 batch with one read-only repeatable-read PostgreSQL transaction for the membership generation, source watermark, bots/viewer organization, private sections, and own main-conversation activity. The source millisecond timestamps and snake-case projection contract are preserved. Type checking and combined PostgreSQL checks passed exact projection revision, pin/section/tags/main mapping, private sections, foreign membership denial, revoked-read denial, and rejoin generation. The durable publisher and stream integration remain to port and verify. No production changes applied.

Ported original WorkspaceSyncPublisher, internal stream transport, wake/recovery helpers, and WorkspaceSync Durable Object wrapper. The SQLite viewer outbox, immutable pending append, serialized publisher work, producer acknowledgement checks, membership recheck, bounded generation rotation, expired-stream rebasing, and alarms are retained. Shared clock reads/publication/recovery now use native PostgreSQL. The wrapper reuses TanStack host/database context, with its existing runtime declaration extended using the official Cloudflare DurableObject type. Type checking passed. Six publisher tests passed using actual local SQLite and mocked source/transport boundaries: restart after lost acknowledgement, concurrent snapshots, membership revocation/rejoin, generation bounds, expiry rebasing, and revocation during append. PostgreSQL publication/recovery queries and actual Cloudflare RPC/streams still require integration verification. No Cloudflare binding or production deployment applied.

Ported original BotWorkspace sidebar and section read helpers into bot-workspace-reads.ts. Native PostgreSQL queries preserve full sidebar metadata, viewer state, explicit main mapping, private sections, source plain-array results, and bounded ID-keyset section discovery. Fixed a timestamp precision mismatch exposed by comparing the full helper output to the shared sync projection: both now retain original integer milliseconds. Type checking and combined PostgreSQL checks passed full projection equality, viewer-private sections, case-insensitive discovery, the 101-row lookahead bound, and stable paging independent of display order. Full BotWorkspace mutation commands, harness runtime, and UI remain to port. No production changes applied.

Ported source BotWorkspace createSection, patchSection, and deleteSection into WorkspaceSections. PostgreSQL transactions and per-viewer order locks replace D1 batch guard records; membership is locked and section versions remain the edit gate. Position edits retain original clamping, dense ordering, and version increments. Sync wakeups require only the binding they use. Type checking and combined PostgreSQL tests passed eight concurrent creations with distinct positions, atomic reordering, sort metadata, exactly one winning concurrent edit, stale/foreign denial, section deletion clearing assignments, and sync wakeups. Bulk setSections and remaining BotWorkspace lifecycle/history/group mutations remain to port. No production changes applied.

Ported original bulk setSections and its removeEmptySections behavior into WorkspaceSections. The captured bot versions and previous section IDs remain the write gate. PostgreSQL locks current membership, selected bots/viewer rows, and target sections, then performs one JSONB-backed upsert and scoped empty-section cleanup in the same transaction. Type checking and combined PostgreSQL checks passed batch assignment, occupied-section retention, empty-section removal, invalid batch rollback, duplicate/deleted selection rejection, competing stale assignment rejection, and foreign membership denial. Remaining BotWorkspace lifecycle/history/group mutations and runtime/UI integration are unfinished. No production changes applied.

Ported original BotWorkspace.reserve into workspace-lifecycle-reservation.ts. Native PostgreSQL selects the same workspace-scoped main and thread conversations in stable order. Original identity binding, shared reservation token, draining retries, deadline, active execution denial, explicit release, and failure cleanup remain. Type checking and combined PostgreSQL verification passed workspace scope, complete selected conversation identities, one token, release, and cleanup when a later conversation rejects reservation. Conversation RPC responses were simulated. Full lifecycle callers and real Durable Object integration remain unfinished. No production changes applied.

Ported original BotWorkspace.get as readWorkspaceBot, sharing the existing exact sidebar projection with a database-side ID predicate. Original workspace scope and missing-conversation error remain. Type checking passed, and PostgreSQL checks passed exact projection equality for each conversation, absent IDs, and cross-workspace exclusion. Remaining workspace mutations and runtime/UI integration are unfinished.

Aligned the source personal-assistant classifier with the destination identity generated by openPersonalChatWorkspace: assistant:<account> in personal:<account>. Removed the copied Gum-specific kody identity assumption. Two focused tests passed, covering exact personal identity and exclusion of foreign accounts, organization conversations, ordinary conversations, and old Gum IDs. This fixes the shared classifier for forthcoming command/UI wiring; it does not prove all lifecycle command paths are wired.

Ported source database parent guards in migration 0034. PostgreSQL triggers retain active same-workspace parent validation and recursive cycle rejection, with workspace-scoped transaction locks for hierarchy and parent availability writes. Combined PostgreSQL verification passed insertion/update rejection for unavailable parents, self and descendant cycles, valid moves, and concurrent opposing moves with exactly one committed relationship. The latter may abort a competing transaction through the database deadlock detector, callers still need source-facing error handling when full workspace commands are wired. No production migration applied.

Started the source BotWorkspace command class, reusing the ported WorkspaceSections commands and exact read projection. Source creation, parent traversal, version/availability checks, and membership checks are retained. PostgreSQL transactions create the bot, conversation and explicit main mapping atomically, with membership locked at admission and source-facing parent race errors. Type checking and combined PostgreSQL verification passed six concurrent distinct creations, main mappings and source result metadata, nested creation, foreign/inactive parent rejection, membership/input denial, and sync wakeups. Patch/history/group/lifecycle commands remain unfinished. No production changes applied.

Ported source BotWorkspace.patch. PostgreSQL locks membership and current bot state, checks the source expected version/deletion gates, applies metadata atomically, retains parent and personal assistant guards, and preserves archive reservation identity-set/deadline fencing with unconditional release. Original D1 mutation leases become native transaction checks rather than compatibility tables. Combined PostgreSQL checks passed competing edits with one winner, stale/deleted/foreign denial, assistant archive prevention, parent checks, archive/unarchive, and a late conversation appearing after reservation causing rollback and release. Durable Object reservation RPCs were simulated; real runtime wiring remains unfinished. No production changes applied.

Ported source BotWorkspace.organize and reorderBots. Viewer fields use supplied-field-only upserts, preserving concurrent pin/tag updates. Native PostgreSQL transactions and shared viewer-order locks retain membership/version/deletion gates, private section validation, source peer-group selection, dense position assignment with clamped placement, and empty previous-section removal. Type checking and combined PostgreSQL verification passed private viewer projections, deduplicated tags, concurrent field merging, invalid-section rollback, three-peer dense ordering at start/end, and empty-section cleanup. Full history/group/lifecycle commands, runtime and UI remain unfinished. No production changes applied.

Ported source subtree deletion and restoration into BotWorkspace. Native PostgreSQL transactions replace snapshot mutation leases, retaining complete subtree/version comparison, reservation conversation-set fencing, expiry rollback, unconditional release, active-ancestor reparenting, and deletion-batch-specific restoration. Hierarchy changes serialize at workspace scope, row locks cover only observed subtree members. Source Trash/version behavior is retained and personal assistant deletion is rejected explicitly. Type checking passed before the final query-only lock refinement, combined PostgreSQL checks passed both before and after refinement: subtree delete/restore, older deletion exclusion, reparent deletion, stale/assistant denial, and a new descendant arriving during reservation causing rollback. Reservation RPCs were simulated. History/group commands and actual runtime/UI/deployment remain unfinished. No production changes applied.

Ported source move/moveGroup using the unchanged botDragLayout and moveBotGroup algorithms. PostgreSQL commit locks viewer order, hierarchy, membership and layout rows, rechecks the complete captured layout inside the same transaction, validates destination section/parent, then applies root hierarchy changes and projected viewer metadata atomically. Sidebar reads now accept the existing transaction to avoid a second-pool read during commit. Type checking and combined PostgreSQL verification passed complete projected hierarchy/viewer/position/version equality, parent-child selection deduplication, carried subtree metadata, stale layout denial, one winning competing move, and cycle rejection. Source applyHistory remains to port. Conversation runtime, API/UI integration, bindings and deployment remain unfinished. No production changes applied.

Ported source applyHistory, retaining original input/identity/hierarchy validation and guarded before-state comparisons. PostgreSQL transactions replace mutation leases, lock membership/layout/sections, verify section ownership and assignment removal, recreate sections before assignments, detach changed parents before applying the final hierarchy, preserve archive timestamps, advance versions, and release archive reservations unconditionally. Type checking and combined PostgreSQL checks passed undo/redo, section recreation/removal, stale history conflicts, one winning concurrent change, archive/unarchive and whole-change rollback when one affected row conflicts. All source public BotWorkspace command methods now have destination implementations, with section commands inherited from the ported WorkspaceSections. This is not full consolidation completion: command API/runtime wiring, actual Durable Object integration, chat UI, bindings, auth end-to-end and production cutover remain unfinished. No production changes applied.

Ported the full original assistant-conversation-tools service and TanStack AI definitions. Reuses the shared ConversationIdentity resolver and ported BotWorkspace, replacing D1 main-mapping lookup and sidebar reads with native PostgreSQL. Tool descriptions, expected version handling, explicit setting writes, changed-after-write outcomes, main-only restriction and initiating/target access rechecks remain. Type checking and combined PostgreSQL verification passed inspect metadata, rename/pin dispatch, stale write denial, fresh thread target exclusion, foreign target exclusion, and deleted initiating conversation denial. Section tool dispatch and real model/runtime registration still need end-to-end checks. No production changes applied.

Ported original recipes storage as chat_recipes in migration 0035 and extracted SavedActions from source API create/delete and workspace/runtime reads. Fields and integer millisecond creation timestamps retain the source contract. Shared authenticated membership protects reads and mutations; creation locks current policy and membership, parses the original recipe schema and requires allowKody, while deletion remains possible when creation is disabled. Type checking and combined PostgreSQL tests passed 35 concurrent actions, private listing/creation/deletion scope, the 30-action runtime bound, input validation and policy-gated creation. Conversation runtime remains to adapt and register this service. No production migration applied.

Extracted original Conversation lifecycle, retry-readiness and run-context database boundaries into conversation-database.ts. Native PostgreSQL reads preserve bot/thread archive/deletion metadata, exact ready retry/copy pair and account/target scope, current member policy, source bot metadata and bounded action reads. Run context uses one read-only repeatable-read snapshot. Invalid UUID readiness inputs return false rather than a PostgreSQL input error, retaining the source missing-identity outcome without casting indexed identity columns. Type checking passed before this final UUID-input refinement. Combined PostgreSQL checks passed context privacy and bot scope, integer source timestamps, action limit, lifecycle missing/active states, actual ready/ready and failed/failed retry pairs and foreign/malformed identity denial. These are internal database boundaries, not authorization replacements. Full Conversation class adaptation and runtime registration remain unfinished. No production changes applied.

Ported Conversation.activateCopyImport activity/read publication checks and discardCopyImport published-conversation lookup into native PostgreSQL boundaries. The source event-version and exact message-count gates run before markConversationRead, followed by persisted watermark confirmation. As in the source, copy/identity authorization precedes these internal checks and remains the caller responsibility. Type checking and combined PostgreSQL verification passed missing/stale projection, mismatched message count, scoped read update, successful watermark confirmation, and published/missing conversation detection. Full copy activation state transitions and real Durable Object integration remain to wire and verify. No production changes applied.

Registered source StreamObject and ported WorkspaceSync as named exports from the existing TanStack Worker entry, retaining its Sentry/host/runtime/request implementation. StreamObject is the same @durable-streams/server-cloudflare package class used by Gum. Added STREAMS and WORKSPACE_SYNC bindings and a fresh tanchat-v1 SQLite Durable Object migration to TanStack Wrangler configuration. Wrangler configuration/runtime type generation and project type checking passed. Types were generated to a temporary file, not applied over existing production environment declarations. No deployment or remote migration occurred. Conversation/Workflow classes and bindings, live RPC/stream behavior, API/UI integration, auth and /builder cutover remain unfinished.

Ported full source Workflow driver as TanChatWorkflow with an explicit Conversation advanceWorkflowRun RPC contract and official Cloudflare Workflow types. Original params schema, 900-pass bound, durable checkpoint names, retry/backoff/timeout, receipt-only persistence, deadline-relative sleeps, terminal status handling and needs_attention exhaustion result are retained. Ported both original driver tests, adapting paths/class name only; both passed, covering stable step reconciliation and no model-loop fallback on RPC failure. Project type checking passed. Workflows binding/export and actual Conversation integration remain to wire together; no remote workflow deployment occurred.

Ported the remaining source Conversation workflow-child publication, router username hint and final usage receipt-start reads into conversation-database.ts. Exact child conversation/bot/account matching and integer receipt timestamps are retained. Type checking and combined PostgreSQL verification passed true/false child identity matches and existing receipt timestamp equality. Username projection was compared for available fixture rows; real account hints remain to verify with runtime integration. These internal reads require the original caller authorization flow. Full Conversation class adaptation and live registration remain unfinished. No production changes applied.

Started the full original Conversation class port, copying the complete source file rather than reconstructing its loop. Updated moved identity/credentials/copy imports, exposed the shared inferred ConversationIdentity type, defined explicit runtime binding contracts, and switched already-ported activity, identity, execution authority, policy preference, schedule lifecycle, memory, workflow definition and usage calls away from D1 signatures. The first project type check reports remaining unconverted D1 accesses, service option differences and platform/RPC type mismatches. The class is not mounted/exported from the Worker and is not ready to deploy. Compilation is currently incomplete while the native runtime boundary adaptation proceeds. No production changes applied.

The complete source Conversation class now passes the destination project TypeScript check after replacing its remaining D1 reads with the native PostgreSQL services. Delegation and schedule context reads skip saved actions, preserving their original scope. This proves compilation only, the Conversation class still needs runtime context wiring, bindings and live integration verification.

Conversation runtime wiring now scopes constructor recovery and all 78 asynchronous public entry points to the shared host environment, execution context and database context. Nested database scopes reuse the existing context so internal calls share the request connection. The synchronous lifecycleState method remains synchronous and reads local state only. TypeScript passes. Live Durable Object execution and background lifetime verification remain outstanding, and Conversation is not yet registered for production.

The Worker entry now exports Conversation and TanChatWorkflow. Wrangler declares CONVERSATIONS, the separate tanchat-v2 SQLite class migration, and WORKFLOW_RUNS. Generated binding types resolve both classes, project TypeScript passes, and the existing workflow-driver/workspace-sync tests pass (8 tests). No deployment or production migration was run. These checks do not prove full Conversation execution, remaining environment bindings and live integration still need verification.

Conversation FILES now aliases the existing tanstack-notebook-projects R2 bucket, preserving the original saved-files/{UUID} key namespace, and AI is bound to Workers AI. Binding generation and TypeScript pass. The actual Worker build was started, its result remains pending. Gateway configuration and encryption/router secrets have not been provisioned by this change.

The original history/stream handler extraction passes TypeScript. Two HTTP contract tests verify that live responses retain their exact Response identity and stream headers without buffering, and unsupported methods do not invoke the object. These handlers remain unmounted pending the authenticated HTTP dispatcher. The previously pending Worker build completed successfully.

Authenticated GET history/stream routes are registered at /api/chat/conversations/{id}/{operation}. The original handlers use shared TanStack session/capability checks, then native PostgreSQL identity authorization, then bind the resolved identity before reading the object. Seven mocked HTTP boundary/stream contract tests pass, including signed-out, missing capability, duplicate workspace and failed authorization denial before storage access. The actual Worker build passes and includes the generated route. Live session/DO checks remain pending.

The original message submission schema, begin invocation and response status mapping are extracted into conversation-send-api.ts. Identity, bot, policy, recipes, fixture mode and app origin remain supplied exclusively by the server-side caller, not accepted from the request schema. The send handler is not mounted yet, lifecycle and authenticated context admission remain to be connected.

The original send handler is mounted as POST /api/chat/conversations/{id}/send. Shared session/capability and same-origin checks precede PostgreSQL identity/lifecycle authorization; bot, policy, saved actions, user, origin and non-fixture mode are derived server-side. The original Conversation.begin remains responsible for admission revalidation. TypeScript passes and the HTTP boundary suite passes 8 tests, including cross-origin denial, archived denial and rejection of request-supplied user/policy/fixture context. Live model execution and UI remain pending.

Original stop, queue, reset, dismiss-task, continue-task and approval branches are ported and mounted behind shared authorization. Stop remains allowed for archived conversations, queued resume/run-next remain denied for archived/deleted conversations, and approval/continuation contexts are loaded server-side only when needed. Archived thread state is included in the native lifecycle gate. The existing eight HTTP boundary tests pass after preserving early archived send denial. Live control behavior remains unverified.

The nine original browser client modules, WorkspaceApi, ExecutionSessionEvidence and loading UI dependencies are copied byte for byte with source hashes in tanchat-client-port.json. Source Durable Streams client and Lucide dependencies are installed. Original browser tests with import-only relocation pass 237 checks across nine suites, and TypeScript passes. This proves the copied browser behavior in isolation, original API paths still need adaptation and the full application UI is not mounted.

The remaining 216 original component/style files are now copied byte for byte, bringing the full Gum component tree into src/chat/components. Provenance remains in tanchat-client-port.json. This is an in-progress UI port: the destination router does not yet declare the original workspace paths, and the source UI dependency ranges are being installed. TypeScript currently fails on those integration boundaries. The UI has not been mounted or claimed ready.

The original workspace, conversation and home-section routes are ported under /chat/w. Copied component links and the original file/conversation navigation helpers use that namespace, with changed hashes recorded. The full application Worker build succeeds with the original UI route tree included. Auth/bootstrap, provider composition, scoped styling and browser behavior remain unfinished, and the destination type check after route generation is pending.

The full copied UI passes TypeScript after binding HomeDashboard search to its exact workspace route and aligning React DB 0.4.1 with the original collection API. /chat now owns the original tooltip/execution provider composition above workspace navigation, reusing the existing site Query provider. The provider shell Worker build passes. Bootstrap, scoped global styling and live browser verification remain incomplete.

Bootstrap workspace data now composes the original bots, sections, activity, recipes, policy and accessible-workspace reads through native PostgreSQL services after membership authorization. The source onboarding table/service is still missing and must be ported, no synthetic onboarding state is supplied. Credentials, spending and full HTTP bootstrap composition remain outstanding.

Onboarding now has native PostgreSQL tables and migration 0036, preserving source status/use-case/revision/completion constraints and command receipts. Personal workspace creation initializes pending onboarding atomically. The source service access checks, exact command digest replay, version conflict and name/use-case/save/skip semantics are ported with PostgreSQL row-locked transactions replacing D1 batches. Actual PostgreSQL concurrency and rollback tests remain required. No production migration was run, and bootstrap remains unmounted.

The complete native PostgreSQL workspace verifier passes with onboarding migration 0036. New checks cover eight identical command submissions returning the exact same receipt, changed payload rejection, competing revisions with one winner, skip preserving name/use-case, and an injected workspace update failure rolling back both onboarding state and command receipt. The local PostgreSQL cluster was stopped afterward. This does not verify real simultaneous distributed connections or the HTTP onboarding UI.

Original account onboarding GET/POST behavior is mounted at /api/chat/account/onboarding through shared session/capability checks, same-origin mutation protection and original bounded JSON parsing. Four HTTP tests pass for session-derived account selection, signed-out denial, cross-origin denial and service dispatch. Worker build succeeds. The copied browser request base still needs /api/chat alignment, bootstrap remains incomplete.

The original WorkspaceApi now resolves all account/workspace requests under /api/chat, supplying workspaceId scope consistently to fetch and stream URLs while preserving existing query parameters. Eighteen URL/collection tests pass. Not all original HTTP operations are mounted yet, so this does not make the full app functional. Onboarding route TypeScript passes.

Bootstrap response composition now uses native onboarding, workspace inventory, encrypted connections, Kody local sign-in state, MCP accounts, daily usage and funded-spend services, mapped to shared TanStack AuthUser. Original workspaceActivity serialization is copied explicitly to preserve the browser field contract. The bootstrap service remains unmounted pending environment and HTTP integration and actual database verification.

The complete PostgreSQL verifier passes native bootstrap identity, personal assistant, pending onboarding, included connection defaults, activity serialization and foreign-workspace denial on an isolated new account. The authenticated bootstrap GET endpoint is mounted at /api/chat/bootstrap and source non-secret model/Kody settings are declared in Wrangler. Encryption/router/Gateway secrets remain unprovisioned, bootstrap reports configuration failure rather than fabricating credentials. Local PostgreSQL was stopped after verification. Worker endpoint build is pending.

### Chat entry and main conversation HTTP routes

The `/chat/` entry now uses the existing TanStack current-user lookup and login return path, then opens the native personal workspace and assistant. The chat parent suppresses the site navbar and footer. The actual Worker build and TypeScript check passed for this entry change. The bootstrap endpoint Worker build also passed.

The copied Gum client requests main-chat history and sends through `bots/:id`, while threads use `conversations/:id`. Both HTTP routes now use the same native conversation service. Bot routes resolve the signed-in user's main conversation through PostgreSQL membership and ownership checks before accessing a Durable Object. No caller-supplied conversation identity is trusted. Ten conversation HTTP boundary tests pass, including bot reads and sends resolving to the authorized main conversation.

The bot route is new TanStack boundary wiring around the previously ported original Gum read/send/control handlers. It does not reconstruct their behavior. Live browser execution, the remaining HTTP operations, and a build including the new bot route remain unverified.

### Committed send receipts

Ported the `send-receipt` branch from Gum `src/server/api.ts` into the shared conversation HTTP boundary for both bot and thread routes. It calls the original ported `Conversation.sendReceipt` method after account ownership resolution and identity binding. It validates the original message identifier limits and uses the existing TanStack JSON response utility. This restores the server endpoint needed by the copied `usePendingSend` reconciliation logic. Twelve HTTP boundary tests pass, including committed receipt passthrough, binding before receipt lookup, and rejecting absent message identifiers. Live submission recovery remains unverified.

### Composer draft HTTP wiring

Mounted the existing native PostgreSQL composer draft service under `/api/chat/account/composer-drafts/:accountId/:scope`. The HTTP boundary preserves Gum's original account mismatch rejection and bounded JSON handling, with TanStack session authentication and chat access checks. The copied `useCloudDraft` changes only its URL namespace, retaining its original sync, conflict and revision logic. Five HTTP tests pass for account isolation, signed-out reads, cross-origin writes, revision forwarding and malformed JSON rejection. The previously verified native PostgreSQL service retains its optimistic revision checks and empty-value tombstones. Browser draft syncing and generated route build remain unverified.

### Account preferences HTTP wiring

Mounted Gum's account preference read/write operations at `/api/chat/account/preferences`, using the previously ported native PostgreSQL preference service and TanStack session identity. The copied preference client already uses the shared chat API namespace, so no client logic changes were needed. Five HTTP tests pass for session identity, signed-out reads, same-origin writes, bounded JSON forwarding and conflict status preservation. The Worker build containing bot routes and composer drafts finished successfully. Preferences were added afterward and still need route generation and build verification. Full browser settings behavior remains unverified.

### Workspace index read wiring

Ported Gum `src/server/workspace-index.ts` directly, changing only the database parameter and the import of the already ported native read functions. Mounted `/api/chat/workspace-index` using shared session identity and an explicit workspace membership check before reading bots and private sections. This restores the original sidebar index response shape. The preferences Worker build passed. The new workspace index route and live sidebar refresh remain unverified.

Workspace index HTTP verification: five boundary tests pass, proving session identity is used, membership is checked before index reads, signed-out and unauthorized accounts do not read data, and duplicate workspace selectors are rejected. These are mocked HTTP boundary checks, not a live sidebar or database verification. Source and destination hashes for the original index composition are now recorded in the server port manifest.

### Workspace sync HTTP port

Ported Gum's workspace sync snapshot and stream branches from `src/server/api.ts`. Both now use TanStack auth and the native PostgreSQL membership generation. Original generation checks before and after snapshots remain. Long-poll streams recheck the session and membership before returning, canceling the response body if access changed. Stream responses pass through without buffering or reconstruction. Four HTTP tests passed for stream passthrough, membership-change cancellation, snapshot generation rejection and signed-out denial. The workspace index Worker build passed. The sync routes still need generated route build and real Durable Object/browser verification.

### Committed sidebar mutation responses

Ported the original `indexResponse` helper from Gum's API before wiring sidebar mutation endpoints. A committed mutation still returns success with `syncPending` when snapshot delivery fails, preventing the client from retrying an already committed command. Access loss returns 403, and deployments without the publisher use the original index read response. Three focused response tests passed. This helper is not yet attached to mutation routes. Sync HTTP and response helper provenance are recorded in the server manifest. The sync route Worker build is still running.

### Sidebar section HTTP commands

Mounted the original create, patch and delete section dispatch against the previously ported `WorkspaceSections` service. Shared session and workspace membership checks precede changes, request bodies remain bounded, and original version validation stays in the native service. Committed commands use the original index/sync response semantics. Three HTTP boundary tests pass for authorization ordering, revision forwarding and cross-origin rejection. The workspace sync Worker build passed. The section route build is running, and actual browser mutations remain unverified.

### Bot mutation HTTP wiring in progress

Connected original Gum API dispatch for bot creation, patch, organization, move, delete and restore to the previously ported native `BotWorkspace` service. The service retains original optimistic versions, personal assistant protection, subtree behavior and lifecycle reservations. Creation keeps its original direct JSON response, and other mutations use the original committed index/sync response helper. This boundary wiring is not yet verified by tests, generated route build or live browser use. The section Worker build passed.

Bot mutation HTTP verification: seven tests passed covering direct create response, workspace authorization before creation, patch revision forwarding, cross-origin denial, move/delete/restore dispatch and rejecting POST organization changes. The preceding full sidebar TypeScript check passed. It started before bot mutation wiring, so it does not prove the new bot routes type-check. The bot mutation build remains running. Source sections and hashes for section and bot mutation boundaries are now recorded.

### Bulk sidebar commands and group moves

Extracted the original Gum bulk command loop directly from `src/server/api.ts`. It preserves individual success/failure results and archive revision forwarding. Mounted bulk and group move POST routes using the existing authenticated bot mutation boundary and native `BotWorkspace.moveGroup`. Two focused bulk service tests pass for partial archive failure and pin dispatch. The original bulk loop remains sequential, this port does not claim a speed improvement. The preceding bot mutation Worker build passed. New bulk routes still require build/type and live browser verification.

### Sidebar history HTTP wiring

Connected Gum's original workspace history POST dispatch to the native `BotWorkspace.applyHistory` service and original committed sync/index response. The existing PostgreSQL service retains before/after validation and atomic history application. Nine bot mutation boundary tests now pass, including history and group move dispatch without accidental bot creation. Actual UI undo/redo and the latest route build/type checks remain unverified. The prior bulk route build is still running.

### Combined sidebar verification and navigation correction

All 48 tests across nine new boundary/service suites pass together. The full sidebar Worker build and TypeScript check passed. Original navigation tests found a leftover `/w/` regex in sign-in destination validation, which rejected the intentionally moved `/chat/w/` links. Updated that prefix and original test URLs, preserving bounds and open redirect rejection. All 24 navigation/message navigation tests now pass. The regex correction was made after the build/type check and still needs subsequent compilation.

### Conversation read acknowledgements

Ported Gum's `read` POST branch to both main bot and thread conversation routes. It validates the original safe integer version body, resolves account/workspace ownership, calls native `markConversationRead`, and returns the original persisted read-version acknowledgement. The source acknowledgement SELECT now uses PostgreSQL table names and explicit numeric decoding. Like Gum, this operation does not open a conversation Durable Object. Thirteen conversation HTTP tests pass, including account-scoped read marking. The new native acknowledgement query still needs actual PostgreSQL verification, and live unread behavior remains unverified.

### Read acknowledgement PostgreSQL verification

The full native PostgreSQL verifier passed on a fresh isolated database after adding acknowledgement query checks. Authorized reads return the persisted bounded version; foreign account and foreign workspace reads return zero. Existing monotonic read markers, activity outbox delivery and stale event checks also passed alongside all existing native workspace verification. The isolated database server was stopped afterward. These prove the PostgreSQL query behavior, not live browser unread state.

### Transcript navigation and archived history HTTP port

Ported Gum's navigation and archive read branches through the already authorized main-chat/thread endpoints. Navigation retains cursor validation and the original required epoch for earlier pages, allowing only the additional workspace selector required by the shared API. Archive reads preserve exact message lookup and safe integer paging. Sixteen conversation HTTP tests pass, including navigation forwarding with epoch, duplicate cursor rejection and archived message passthrough. Real transcript storage/browser paging and the new handler compilation remain unverified.

### Broad ported core verification and model catalog wiring

The complete ported core suite passed: 166 suites and 1,866 tests. This is broad source-contract coverage, not proof of full live parity. Mounted the original model-options operation against the already ported model catalog and model environment services. The endpoint uses shared account identity, workspace policy and live configuration, with no fixture choices. Its new HTTP wiring and generated route build remain unverified.

Model catalog HTTP verification: four tests passed for server-owned identity and policy, disabling caller-selected fixture behavior, denying provider configuration reads after access rejection, and preserving configuration errors. The preceding full type check passed for transcript/read-marker wiring. Model routes were added afterward, so their compilation is still pending.

### Saved action HTTP wiring

Mounted original recipe create/delete operations against the native `SavedActions` service. Shared session and workspace membership checks precede dispatch, writes enforce same-origin and bounded JSON handling, and original service policy validation remains. Three HTTP tests pass for create forwarding, delete identity and cross-origin denial. New saved action route generation and live settings use remain unverified.

### Provider connection settings port

Extracted Gum's original provider connection update callback, preserving existing provider keys when no new key is supplied, normalizing included models to server configuration and removing included API keys. Mounted the connection POST endpoint with shared session/workspace policy checks and native encrypted credential storage. Three service tests passed for key preservation, included normalization and policy rejection before storage. Endpoint/live settings behavior remains unverified. The provider/saved action route build is running.

Provider HTTP verification: five boundary tests passed for session-owned credential target, authorized workspace policy, signed-out denial, no configuration access after membership rejection, configuration error preservation and cross-origin rejection. The actual Worker build containing provider and saved action routes passed, and generated routes contain those endpoints. The current full type check is still running. Live credentials and model execution remain unverified.

### Thread HTTP wiring

Ported the original thread list, detail, create, rename, archive and delete dispatch through existing conversation routes, using the native `ConversationThreads` service. Shared account/workspace authorization precedes service access, and mutations retain same-origin/bounded request handling. DELETE preserves the source behavior of reading the current version then archiving with lifecycle reservation enabled. Three boundary tests passed for listing, versioned delete dispatch and cross-origin denial. Create/rename runtime behavior and the latest compilation remain unverified.

Thread HTTP coverage now includes six passing tests for original idempotency/source message forwarding, rename version forwarding, malformed command rejection, listing, delete/archive semantics and cross-origin checks. Source provenance is recorded. These mocked dispatch checks do not prove transcript context capture or live thread creation. Actual PostgreSQL thread service contracts were verified in the broader native verifier, while the current Worker build and full type check are still running.

### Saved-file HTTP routes

Connected the existing ported `fileApi` to main bot, thread conversation and draft file routes, including metadata and content paths. Shared account/workspace checks precede access; main and thread routes resolve authorized conversation ownership before touching R2. The original file API retains content streaming, download headers, preview restrictions, bounded uploads and native storage behavior. This is boundary wiring around existing source code. The thread full TypeScript check passed. New file route build is running; file HTTP boundary checks, actual R2 streaming and browser upload/download remain unverified.

File route Worker build passed. Four HTTP boundary tests passed for exact original Response passthrough, ownership rejection before R2 lookup, session-owned draft scope and cross-origin upload denial. These mock the original file API and do not prove live R2 uploads or downloads. The full type check is still running. File boundary source provenance is recorded.

### First-message draft execution gap

Source inspection found that the native draft port currently implements reservation and receipts, while original `BotDrafts.start` execution orchestration is not yet wired. Added the native started-receipt write needed by that source flow, retaining session-owned workspace membership checks in a transaction. The runtime port still needs original model/attachment/reference validation, authorized conversation admission and post-admission receipt persistence. This method is not yet verified. No draft start route has been mounted prematurely.

### First-message runtime source port

Added `startBotDraft`, copying the original model/attachment/reference preparation block directly from Gum `BotDrafts.start`. Native draft reservation retains the frozen model choice and file promotion. The original conversation begin payload uses `draft:<id>` idempotency and only persists started state after admission succeeds. Authorized identity is explicitly bound before begin. Fresh-only drafts require the reserved model; legacy model-less data recovery is not included because no data migration is requested. This orchestration is not yet mounted or runtime-tested. Its full type check is running.

Draft started-receipt verification passed in the full native PostgreSQL verifier on a fresh database. Reservation begins unstarted, markStarted persists started state, replays remain idempotent, and a foreign account cannot mark the receipt. A TypeScript check caught an intersected namespace overload selecting the narrower reference stub; the draft environment now uses the full Conversation namespace explicitly while preserving the remaining reference environment. The corrected type check is running. Actual admission and draft HTTP mounting remain incomplete. The isolated database server was stopped.

### First-message draft endpoint mounted

Mounted original draft receipt GET and start POST operations. Reads use native account/workspace draft persistence without requiring provider credentials. Starts derive account, policy, saved actions, live mode and app origin server-side, then call the source-based draft orchestration. Three HTTP tests pass for server-derived context, credential-free receipts and cross-origin denial. Corrected draft runtime types passed before endpoint mounting. The endpoint Worker build is running; live first-message execution remains unverified.

### Shared sign-in UI

The draft endpoint Worker build and full TypeScript check passed. Removed the imported Gum magic-link sign-in flow from the chat App and reused TanStack's existing SignInForm for expired or missing sessions. Social login now uses the existing shared auth client and returns to /chat. Legacy Gum hash-token handling is removed, no separate authentication implementation is introduced. The new UI change still needs compilation and browser verification.

### Original base styles mounted

Shared sign-in TypeScript verification passed. Ported original motion, mobile and base CSS in original import order, retaining font loading and every source rule. A chat-only scope is active while the ChatShell marker exists, and the chat route provides the stylesheet link. The marker uses display: contents to preserve existing app layout. This needs actual Worker CSS compilation and rendered browser verification, including navigation back to non-chat pages. Appearance preference synchronization and mobile service-worker infrastructure remain separate unfinished work.

### Execution session dispatch port

The scoped base-style Worker build passed. Copied the original execution session command, snapshot, history and event cursor dispatch block from Gum api.ts into the shared-auth route boundary. Existing Conversation execution RPCs remain the implementation. Workspace query scoping is removed before original execution cursor validation, and account ownership is resolved server-side. Original local opt-in execution restriction remains. Snapshot blob routes and live browser host execution are still unfinished. Compilation is running.

### Execution snapshot source port

Copied Gum's original execution-project-snapshots service, retaining bounded transfers, R2 checksum verification, repeat authorization and idempotent reservations. Added GET/PUT snapshot routes and adapted the original execution client to /api/chat with immutable workspace query scoping. The first execution dispatch type check found numeric status arguments being passed to TanStack's ResponseInit helper, corrected to jsonError. Worker compilation is running, live snapshot transfers remain unverified.

Execution snapshot Worker build passed. All 89 original transport and snapshot-format tests pass after adapting URL assertions to the chat namespace and workspace query. Five new shared-auth boundary tests pass for server-owned identity, cross-origin denial, preserved opt-in restriction, unchanged snapshot Response forwarding and invalid cursor rejection. These tests do not prove live R2/DO transfers or browser host execution. Full TypeScript verification is still running.

Snapshot full type verification found source global R2 types broader than the shared storage interface. Verification now requires only size/checksums, the fields it actually inspects, and conditional creation uses the existing typed etagDoesNotMatch wildcard instead of a Headers option. No casts or compatibility shim added. The corrected full type check is running.

Corrected execution snapshot full TypeScript verification passed. Ported original task-usage, runs and action-evidence read dispatch blocks from Gum api.ts into the authorized conversation endpoint. Retains original pagination limits, usage selection and RPC behavior. Type verification is running; live run-history and usage UI behavior remain unverified. Appearance isolation audit found multiple body portals outside the existing PortalContainer context, so a coordinated portal/theme change remains outstanding.

Run/usage/evidence full types passed and 22 conversation boundary tests passed. Added the original copy-boundary read dispatch, replacing only its D1 lifecycle lookup with the existing native PostgreSQL lifecycle reader after ownership authorization. Original message/side validation and RPC status semantics remain. Copy boundary tests and latest type verification are running.

Copy-boundary full types and all 24 conversation boundary tests passed. Added original retry-source capture with native lifecycle and membership-owned policy readers, server-derived live mode, and original bounded message selection. RPC JSON is parsed through a typed result envelope and the existing parseRetrySource validator instead of the source's result cast. Latest boundary tests and full types are running. Actual retry branch creation and live recovery remain separate unfinished verification.

Retry-source full TypeScript verification passed. Added original delegation history/current-task read dispatch and schedule snapshot read using the existing Conversation RPCs and ownership boundary. Controls are not mounted yet because source workflow-child parent control restrictions need native persistence wiring first. Latest conversation boundary tests and types are running.

Delegation/schedule read full types passed. Added the source workflow-child owner lookup using PostgreSQL and preserved the original parent-only restriction for all mutation operations except read acknowledgement. Connected original delegated-task cancellation and schedule command dispatch after that guard. Latest tests and full types are running; the ownership query and live controls still need real database/runtime verification.

Workflow owner lookup passed in the full fresh PostgreSQL verifier: a published child resolves its owning conversation, a main conversation and unknown ID resolve null, and existing admission replay/foreign-owner checks remain passing. The controls type check found the original combined-method GET schedule branch unreachable in the POST-only handler, removed that branch because GET is already mounted separately. Corrected full types are running.

Corrected delegation/schedule control types passed. Ported original workflowApi definition list/read/command behavior and mounted shared-auth collection and revision reads against the native Workflows service. Original query validation, immutable revision commands and private no-store responses retained. Worker build is running. Workflow run/start/cancel HTTP wiring remains incomplete.

Workflow definition Worker build passed. Copied original workflowRunApi start, withdraw, inspect, list, answer/files and cancel dispatch, preserving strict inputs, 202 start status and pagination. Mounted behind shared session/account/workspace identity and typed Conversation namespace. Worker build is running; actual workflow admission/execution and run HTTP boundary checks remain unverified.

Workflow run Worker build passed and four HTTP boundary tests passed. History audit found workflow child metadata omitted from the ported history boundary even though the source read API supports it. Native reader now returns original ownerConversationId/runId/stepId projection and history forwards it to the original response assembler. Updated the PostgreSQL verifier for the complete projection and added a history boundary test. Latest boundary tests and full types are running; the extended projection has not yet been rerun against PostgreSQL.

All 42 current conversation/workflow HTTP boundary tests passed, including workflow-child metadata preservation. These mock coordinator/storage reads and do not replace live runtime proof. Full TypeScript check remains running.

Mounted original bot/conversation copy creation and operation status contracts through native ConversationCopies and shared-auth workspace membership/identity checks. Retains source copying=202, ready=201 and other=200 creation statuses, immutable operation lookup and strict service-owned idempotency. Copy HTTP runtime behavior remains unverified. Build is running.

Copy-route Worker build passed and three boundary tests passed. Mounted original retry create, prepare and get contracts through native ConversationRetries, shared session/workspace membership and server-derived policy/live mode. Preserves preparing=202 and other=200 statuses, explicit preparation and side-effect-free get behavior. Retry namespace, file and MCP configuration are server-derived. Worker build is running; live retry preparation and latest full types remain unverified.

Retry Worker build passed and four retry boundary tests passed for passive status polling, explicit prepare command, authorized creation and cross-origin rejection. Added original copy-source read contract using native getCopySource for the copied origin/return UI, no creation during reads. Latest copy-source tests are running. The full copy/retry type check is still running.

Copy/retry full TypeScript verification passed. Mounted original workspace activity GET contract using the already-ported bootstrap activity serializer and native readBotActivity, with shared session and workspace membership checks. No new activity persistence or inferred states added. Worker build is running; live sidebar refresh remains unverified.

Workspace activity Worker build passed and five boundary tests passed. Ported original owner-only policy mutation to PostgreSQL, preserving policySchema and repeating owner identity in the update predicate. Shared session, membership and same-origin checks precede mutation. New policy route build and native verification remain outstanding.

Policy Worker build passed. Three policy HTTP boundary tests passed. Full fresh PostgreSQL verifier passed including complete workflow child owner/run/step metadata, authorized policy update, foreign owner rejection, invalid schema rejection without changing saved policy and restoration of original policy. The isolated database server was stopped. Full type verification remains running. Live settings remain unverified.

Mounted original workspace-index/activity response contract using the existing authorized activity reader. Its workspaceId/userId envelope is derived from the shared session and validated workspace selector, separate from the plain activity response. Latest activity contract tests and route build are running.

Indexed activity Worker build and six activity boundary tests passed. Mounted original Kody account GET and sync POST contracts using existing readKodyAccount and syncKodyAccount. Shared session/workspace membership precedes configuration lookup, source account policy denial preserved, sync receives server-derived live mode, account reads retain bounded cancellation signal. Route build is running, actual linked Kody account behavior remains unverified.

Kody account route Worker build, full TypeScript check and four account HTTP boundary tests passed. Copied the complete original Kody community service, retaining public catalog search, typed projections, package detail execution, account access checks and account-change rejection. Only its environment type changed to the existing explicit KodyEnvironment. Community HTTP routes remain unfinished.

Community service full types passed. Mounted original community search and listing GET routes under /api/chat, using shared account/workspace checks and original service inputs and 30-second cancellation. Worker build passed and seven original community/account tests passed. Full route type check pending. Live catalog and authenticated listing execution remain unverified.

Community route full TypeScript verification passed. Copied original Kody usage service and its original tests, mounted usage GET through shared account authorization, preserving daily/weekly projections, account-change rejection and 30-second cancellation. Nine Kody usage/community/account tests passed. Latest usage route Worker build pending; live linked-account behavior is not verified.

Kody usage route Worker build passed. Copied complete original Kody mail service and original tests; mounted inbox list, message search and message detail GET routes through shared account/workspace authorization. Original input projection, bounded cancellation, runtime code and account-change checks retained. Mail Worker build and twelve Kody tests passed. Full latest type check pending; no live inbox access has been verified.

Mail route full TypeScript verification passed. Copied original package document service and mounted package document GET under shared account/workspace authorization. Preserves exact package/path matching, safe path checks, account-change rejection and 20,000-character excerpt limit. Original document tests plus account boundary tests passed (eight tests), Worker build passed. Latest full TypeScript check running; live package reads remain unverified.

Package document full type check passed. Mounted original Kody resources GET using the previously ported service for subscriptions, webhooks, secret metadata, secret providers and sharing grants. Resource Worker build and all 21 current Kody read tests passed. These tests validate projections and mocked access contracts, not live accounts. Source provenance refreshed for the shared handler and all newly mounted Kody read routes.

Mounted original Kody run history and run detail GET routes through shared account authorization. Existing ported services retained; original history filters, detail policy restriction and timeout durations preserved. Worker build and ten run/history/account tests passed. Latest full TypeScript check running. Live authenticated runs remain unverified.

Run route full TypeScript verification passed. Mounted original memory search and detail GET routes using the existing ported memory service. Original query/default handling, account checks and 30-second cancellation preserved. Worker build and six memory/account tests passed. Latest full type check running. Memory mutations and live account reads remain unfinished.

Memory read full types passed. Copied complete original memory change service, mounted create review/apply and existing-record review/apply POST routes. Preserves original bounded JSON reader, encrypted tokens, record verification and repeated account checks through original services. Worker build and ten original memory tests passed. Full mutation route types running; live writes remain unverified.

Memory mutation full type check passed. Ported original Kody server add, server control and job control services. Native PostgreSQL membership/policy/link joins replace the original D1 binding queries, preserving source before/after account and policy comparison and desired-state changes. Full project types passed. HTTP control routes and native database/runtime checks remain unfinished.

Mounted original job enable and server add/enable/reconnect/check POST contracts. Shared session, workspace policy and same-origin checks precede commands. Original service input schemas, timeout durations and conditional/unconditional catalog invalidations preserved. Worker build passed, full route type verification running. HTTP boundary tests and native/live service verification remain outstanding.

Kody control route full TypeScript check passed. Five new HTTP boundary tests passed: signed-in scope overrides supplied identity, changed connections invalidate catalogs, unchanged commands do not, denied policy stops before configuration/mutation, cross-origin commands stop before auth, and invalid server IDs do not mutate. These mock service behavior; native authorization joins and live Kody mutations still require integration verification.

Mounted original workspace and conversation reference GET contracts using existing ported listMessageReferences and catalogs. Original kind/query/excludeBotId parsing retained, conversation scope resolves through native identity, session supplies user. Worker build passed. Full types running; endpoint tests, refresh/inspect routes and live autocomplete verification remain unfinished.

Reference lookup full types passed. Mounted original tool refresh, parallel Kody action/account refresh and reference inspection contracts. Source input schemas, allSettled handling and timeout durations retained. Worker build passed. Latest full type check running; HTTP boundary tests and live autocomplete/catalog behavior remain unverified.

Reference catalog full types passed. Seven reference HTTP boundary tests passed for session scope, conversation ownership, duplicate workspace rejection, unsupported kind rejection, action/account refresh calls, original account-refresh failure tolerance and same-origin rejection. Services are mocked here; live picker, native catalog persistence and external refresh still require verification.

Copied original Kody run triage service and mounted triage POST with bounded body parsing and shared account/workspace checks. Original desired-state receipt validation and before/after account checks retained. Worker build and eight original triage/control boundary tests passed. Full types running, live mutation remains unverified.

Mounted original conversation file import POST using native SavedFiles.importFrom. Original immutable file IDs, expected SHA-256, bounded JSON and request cancellation retained. Worker build passed and five file HTTP tests passed, including source/target parameters and server-owned identity. Full types running; live R2 import remains unverified.

Copied original conversation memory API, preserving preference GET/POST, list filters, read and command dispatch, private no-store responses and original input/error handling. Removed D1 argument in favor of existing native Memories. Mounted collection/detail under shared TanStack conversation identity. Worker build passed. Full types and live memory UI verification pending; original SQLite API test cannot be treated as native PostgreSQL proof.

Six memory HTTP boundary tests passed for original filters/private responses, session-owned scope, memory reads, preferences dispatch, command payload, cross-origin denial and invalid pagination. Full memory types still running. Server file audit found semantic-history missing, copied its complete original experimental helper with explicit Cloudflare storage and Typesafe environment types. Original helper is not wired into normal execution and this port does not enable it. Its type verification remains pending.

Conversation memory full types passed before experimental helper addition. Helper type check found original .ts import extensions incompatible with destination config and the copied explicit API key made optional incorrectly; normalized imports and retained required key. Mounted original paired MCP contract GET dispatch including trusted-discovery gating and paired-reader availability. Worker build passed; corrected full types running. Live contract reads remain unverified.

Corrected history helper and MCP contract full types passed. Ten reference/catalog/contract HTTP boundary tests passed, including untrusted discovery rejection, missing paired-reader status and bounded MCP calls. Full consolidated harness suite passed: 191 test files, 1,987 tests. This does not prove live UI, deployed Cloudflare bindings or external accounts; those remain required before consolidation completion.

Mounted device account GET/POST and dedicated device transport POST under /api/chat using existing native connected-devices service. Account commands use shared session/same-origin, transport retains separate bearer credential verification. Worker build and three boundary tests passed. Full types running, desktop URL integration and live device/native persistence verification remain unfinished.

Client endpoint audit found settings sign-out still posting to obsolete Gum /auth/logout. Replaced with existing TanStack authClient.signOut, clear execution account only after successful response, then navigate to shared login. Latest full types running. Kody link/unlink still reference source OAuth paths and need shared-account connection wiring; AppUpdates version endpoint also remains unmounted.

Ported Kody unlink to shared TanStack account identity and native link deletion, original credential removal preserved. The source email-login prerequisite is removed because TanStack identity exists independently of this integration. Client now calls /api/chat/kody/unlink. Worker build passed, full types running. Sign-out type check revealed shared authClient returns void and owns navigation to /auth/signout; removed the assumed response check and competing /login navigation. Kody connect/callback remains unfinished.

Four unlink boundary tests passed: session-owned identity, preserve other credentials, repeated unlink without credential writes, cross-origin denial and unsigned-account denial. Source/client provenance refreshed. Initial unlink type check still observed the previously fixed void sign-out response issue, corrected full type process remains running. OAuth connect persistence audit found original pending/config tables are not yet in native chat schema, so direct native persistence is required before mounting source connect/callback. No existing auth bypass or Gum session will be introduced.

Corrected shared sign-out/unlink full types passed. Added native OAuth client registration and expiring pending connection tables with migration 0037, plus original registration-winner and atomic consume semantics adapted to PostgreSQL. Pending consume additionally binds shared user identity. Added native verifier checks for owner isolation, expiry, one-time consume and registration winner; they have not yet run. OAuth store type check running. Connect/callback routes remain unfinished.

### Native OAuth persistence verification

Ran the complete workspace verifier against a fresh isolated PostgreSQL database, `tanchat_test_oauth_0930_v2`, including migration 0037. It passed the OAuth registration winner, pending owner isolation, single consumption, and expiry checks, along with the existing workspace checks. This verifies persistence, not the live Kody browser authorization flow. Production migrations were not applied.

### Kody connection initiation source port

Ported original PKCE registration and connection initiation to shared TanStack identity and native OAuth persistence. Preserved the normal Kody login redirect for 2FA and copied the original popup completion helper. Full project TypeScript check passed. The callback is still unfinished, so the initiation handler is deliberately not mounted and the client connection action has not been switched yet. No live OAuth success is claimed.

### Kody callback source port

Ported the original connect-only callback to shared TanStack sessions and native PostgreSQL. Added the original `jose` dependency for signature verification. Full project TypeScript check passed. Routes remain unmounted until boundary tests and concurrent account-link collision handling are complete. Live authorization has not been verified.

### OAuth routes connected

Seven connection and callback boundary tests passed, covering shared identity, browser state, issuer, expiry, encrypted PKCE ownership and the 2FA login redirect. Full project types passed before route generation. Account-link insertion now uses both uniqueness constraints without allowing ownership replacement. Mounted connect/callback routes and switched the original popup form to the native endpoint. Live JWT exchange and browser authorization remain unverified.

### Release detection runtime wiring

Mounted the original AppUpdates component inside ChatShell and adapted its version endpoint to /api/chat/app-version. Ported source content hashing into destination Vite config so production builds no longer report development. Original version comparison test and production build passed. Live upgrade prompt behavior remains unverified.

### Mobile runtime and offline scope

Mounted the original MobileRuntime in ChatShell and ported the original public offline worker/page under /chat/. Registration and navigation handling are scoped to /chat/ so other TanStack pages retain their existing behavior. The actual worker test passed for chat fallback and ignoring API, auth and other site navigation. The prior full project type check completed successfully. Browser installation, viewport behavior and offline transitions still need live verification.

### Electron source port

Copied the original desktop host, preload bridge, connected-device transport, native folder helper source, update controller, window lifecycle and tests. Adapted production launch to https://tanstack.com/chat and device APIs to /api/chat. Uses TanStack application identity/profile and TANSTACK_APP_URL / TANSTACK_UPDATE_URL configuration. Built the native helper and all 17 original desktop tests passed before the configuration-name cleanup. Packaging, signing, update hosting and live Electron/shared-auth verification remain outstanding. Source hashes are in tanchat-desktop-port.json.

### Scheduled sync recovery restored

Found the original scheduled workspace recovery was not wired to TanStack cron. Restored it on the existing minute cron alongside the existing workflow sweep, using shared host/database context. Missing native bindings report failure instead of silently skipping recovery. Eight scheduler/publisher tests and the full project type check passed. Live Cloudflare scheduled execution remains unverified.

### Shared-auth live verification attempt

The current checkout now has DEV_SESSION_TOKEN and DATABASE_URL configured. No local ENCRYPTION_KEY, AI_GATEWAY_ID, AI_GATEWAY_ACCOUNT_ID or TYPESAFE_API_KEY values were found, checked by name only. Started the actual TanStack dev server, which selected localhost:3001. Initial browser navigation to /chat timed out without a completed page, so shared-auth rendering remains unverified. The server is still running and should be inspected rather than restarted merely because navigation timed out.

### Live route and auth evidence

Rechecked the same running server. /chat returns HTTP 307 to /login?returnTo=%2Fchat, and the redirected page returns HTTP 200. The real browser visibly renders the existing TanStack GitHub/Google sign-in form. DEV_SESSION_TOKEN is written by the CLI helper but is not consumed by current web auth code, so its presence is not proof of browser authentication. No auth bypass was added. Authenticated workspace rendering still requires the normal shared sign-in flow, and local encryption/gateway configuration remains incomplete.

### Chat deployment schema gate

Added read-only db:verify-chat to both existing manual and CI Cloudflare deployment preparation. It checks all 63 chat tables and declared required columns/nullability from the shared Drizzle schema. The gate correctly rejected the earlier isolated fixture because its verifier omitted migration 0014 (Kody refresh claims). Corrected that migration sequence, reran the complete workspace verifier on a fresh isolated database, and the full verifier plus all 63-table schema check passed. No production migrations or deployment were run. This gate checks relations/columns, while the existing Builder gate checks migration history; live chat behavior still requires separate verification.

### Appearance lifecycle integration

Found AppearanceSync was not mounted in ChatShell. Mounted the original synchronization and added route cleanup that restores only the root CSS properties, appearance attributes and theme-color metadata changed by chat. This retains source root theme support for body portals while restoring the shared site when leaving chat. Six original appearance tests and full project types passed. Rendered theme switching and route-exit cleanup remain unverified in an authenticated browser. Component styles still require a complete isolation audit.

### Source file coverage audit

Compared the current source filesystem directly with src/chat. All core, client and component files have corresponding destination paths. Six server paths do not: auth/email auth are replaced by shared TanStack auth plus split Kody handlers; api.ts is split into TanStack routes; conversation identity uses the native resolver; the development-backend proxy is intentionally replaced by the shared runtime; appearance-html.ts still needs its authenticated initial-paint integration accounted for. File presence does not prove behavioral completeness. Current counts and missing paths are saved in tanchat-source-coverage.json. Shared TanStack manifest and icons replace source app branding assets, with offline assets scoped under /chat/.

Full accumulated harness regression run passed: 197 test files, 2004 tests. This is automated source behavior coverage, not proof of live Cloudflare, shared-auth browser execution, signing, or release completion.

### Shared sign-in cleanup

Removed the unused source SignIn component, which still referenced Gum email/local-email and /auth/login routes. App already imports TanStack SignInForm, and no source imports of the removed component were found. Authentication stays owned by shared TanStack auth. Initial authenticated appearance painting remains unfinished; the original HTMLRewriter behavior cannot be claimed as ported by the currently mounted appearance effect.

### Component stylesheet isolation

Found the 59 component stylesheets were still global even though the main chat stylesheet was scoped. Wrapped their original rules in the same native CSS document scope, active only while .tanchat-shell is present. This preserves the original body-mounted portal styling and disables the rules on other TanStack routes even if their CSS remains loaded. Production build passed. Rendered popover/dialog behavior and route-exit styling remain browser verification requirements. Updated CSS provenance hashes and adaptation notes.

### Local chat secret configuration

Configured a fresh ENCRYPTION_KEY in the ignored local env file and reused the already authorized source TYPESAFE_API_KEY for Jev, without printing values. Set local env file permissions to owner read/write. Source gateway settings were not copied because the source and TanStack Cloudflare account IDs differ. TanStack gateway configuration, local MCP egress, authenticated UI testing and production secret provisioning remain outstanding. No production secrets or account permissions were changed.

### Local MCP network relay

Ported the exact original local-mcp-egress source and its Miniflare runtime dependency. Shared Vite starts the relay in serve mode, injects its ephemeral endpoint/token into worker vars, and disposes it with the dev server. Both original relay tests passed. The running Vite process restarted after configuration changes. Real authenticated MCP calls remain unverified.

### MCP deployment/build configuration

Restored the original compile-time local development flag and Cloudflare public egress assertion in trusted deployment configuration. The first type check identified lost contextual typing after async Vite startup; fixed it by typing the returned config as UserConfig, without casts. Final full project types passed, and the production build passed. Real MCP calls and Cloudflare deployment remain unverified.

### Catalog detail and preview route fidelity

The original API supports plugin and skill IDs in the URL path. The initial TanStack route split only mounted their collection routes, leaving the existing UI detail/version requests and plugin preview URL unmatched. Mounted both detail routes and passed their path IDs to the original pluginApi and skillApi services. Also reject duplicate workspace parameters before policy lookup. Seven HTTP boundary tests passed, covering detail/version request forwarding, shared account identity, preview dispatch, duplicate workspace rejection and cross-origin writes. The generated route tree includes both routes. Live authenticated catalog behavior still needs browser verification.

### Connection-time Kody inventory sync

Found another source behavior missing from the OAuth port: the original callback schedules syncKodyAccount immediately after connecting. Restored that callback step using the existing shared host background lifetime, native personal workspace creation, current workspace policy and the original sync service. Runtimes without background scheduling await the same operation once. Sync failures are logged without invalidating the established connection. Seven sync/callback boundary tests passed. The prior catalog route full type check also completed successfully. A real OAuth success and refreshed catalog still need live verification.

### Production Builder tool reuse

Confirmed the source browser execution bridge is development-only, so copying it cannot replace the production Builder harness by itself. Extracted Builder's actual nine-tool workspace factory and its conversion/npm resolution helpers into builder-workspace-tools.server.ts. The existing Builder route now imports the same factory. Verified the extracted factory body is identical to the checked-in implementation, apart from its export keyword, and recorded its source revision/hash. Full project types and the existing workspace/progress/package-resource tests passed. TanChat still needs project state, tool registration and the existing execution/preview UI connected to this factory before the separate Builder loop can be removed.

### Shared project discovery in TanChat

Connected the conversation tool registry to Builder's existing native project store. User-origin turns in a personal workspace now expose list_projects and inspect_project, with exact conversation access checked on every invocation and ownerId supplied from the authenticated scope. Project metadata stays separate from chat files and threads. No duplicate project tables or storage implementation were introduced. Five focused tests passed for owner-scoped listing, existing ownership checks, company workspace denial and revoked conversation access. Project editing, snapshot contents and execution/preview UI are still not connected, so this is not yet a replacement for the Builder harness.

### Shared project snapshot contents

Extended inspect_project to report runtime, entry and readable paths from the actual stored Builder snapshot. Added read_project_file using the existing Builder file access rules and paginated reads. Snapshot reads reuse the existing R2 object/quarantine lookup, canonical validation and byte limit, and verify the content hash before parsing. Twelve focused tests passed, including real gzip round-trip, corruption rejection, decompression limits, hidden-file restrictions and ownership boundaries. Confirmed the original assistantToolDiscovery inventory includes these tools and passes their descriptions into the existing tool directory and load_tools flow; no task-specific routing was added. Project mutations and execution UI remain outstanding.

Project file type checking initially found the adapter's optional defaulted offset and the cross-platform stream input type. Fixed the offset default and normalized stream chunks to owned BufferSource buffers, with no casts. Final full project types passed. The thirteen final focused tests also verify that load_tools exposes project schemas through the real progressive disclosure flow without executing reads.

### Project edits through the existing Builder implementation

Added replace_project_file to the existing discovery inventory. It invokes the extracted, unchanged Builder replace_file tool, stores the resulting snapshot through the existing owner quota/registry service and commits through updateBuilderProjectState with an expected revision. Current project metadata is preserved. Tool-call/task identity uses the existing stable operation ID helper. Added an owner-checked read of Builder's existing mutation receipts and revisions so a committed edit can be recovered without another snapshot or revision, including after a newer edit. Thirteen focused project tool tests passed. The isolated native PostgreSQL verifier passed real commits, receipt replay, ownership rejection, conflicting receipt rejection, stale revision rejection and exact earlier-revision recovery after a newer edit. No production database changes were made. Production UI editing, execution/preview and release verification remain outstanding.

### Project editor integration

The Projects side panel mounts the existing BuilderProjectPage and ExampleWorkbench. It keeps project stream reconciliation and waits for the existing pending-save flush before switching projects. Embedded mode leaves the separate Builder assistant unmounted. The panel is available only in the signed-in user’s personal workspace.

Production bundling identified browser-only imports in the shared component graph. The panel now loads behind ClientOnly and a compiler-recognized isomorphic import boundary. The production build passed after correcting that boundary. Final type checking is being confirmed separately. Browser execution also still needs verification of isolation headers and OAuth behavior before retiring Builder routes.

### Shared database and browser verification

Normal GitHub sign-in succeeded from the port at localhost:3001. The existing OAuth configuration returned to localhost:3000. The first authenticated chat request exposed missing chat tables in the configured shared database. Read-only inspection confirmed only migrations 0000 and 0001 had been applied and no chat tables existed. Applied the tested pending Drizzle migrations using the normal migration runner, without deleting existing TanStack data. The read-only schema check then verified all 63 required chat tables.

Reloading reached workspace onboarding and rendered the personal assistant sidebar. The localhost:3000 runtime then reported an InvalidCharacterError in @tanstack/redact while rendering an object component. Browser verification returned to localhost:3001 to distinguish that runtime issue from the port. Full authenticated conversation rendering and real model execution remain unverified.

### Renderer compatibility investigation

Authenticated chat also reproduced the object-as-HTML-tag failure on localhost:3001, using @tanstack/redact 0.0.21. Current Redact source recognizes React context objects as providers, unlike that installed release. Updated the official dependency to ^0.1.2 and its lockfile. Type checking passed. Restarted the confirmed Vite process to load the changed plugin dependency, then verified the replacement server became ready on localhost:3001. The signed-in browser remains available for continuing rendering verification, which is not yet proven successful.

### Authenticated live conversation and project checks

With Redact 0.1.2, the signed-in conversation rendered and completed a real included Kimi K2.6 turn, answering the arithmetic prompt with 4. A second natural-language request discovered and executed the file tool, saved consolidation-check.txt, and completed its final reply. The file preview showed the exact requested contents. A separate read of the committed shared PostgreSQL row confirmed ready state, assistant origin, 29 bytes, and a matching SHA-256 digest.

The Projects panel listed existing owned Builder projects. One older snapshot was unavailable in local object storage. Creating a fresh project through the original Builder service succeeded. The existing editor and workbench mounted, compiled its browser template, and displayed its real iframe preview. Clicking Count changed 0 to 1. This proves the tested browser-template path, not WebContainer isolation or all project runtimes.

The production build passed with the renderer update. Embedded editor adaptations prevent changing the chat title to TanStack Builder and remove the old Builder navigation link from embedded errors. Desktop execution, WebContainer isolation, Kody OAuth and tool execution, continuous deployment, and Builder route retirement still require completion.

### Project panel state and access checks

Added regression checks for the explicit personal-project panel gate, independence from desktop and Kody gates, and preserved project tab selection while hidden. These passed alongside the existing project tool contract checks. In the signed-in browser, compiled a fresh project, incremented its preview counter, hid the side panel, and reopened it. The same project, running preview, and Count 1 remained present, confirming no preview remount in this tested hide/show path. Embedded title behavior also now leaves the page titled TanStack.

### Assistant project creation

Added create_project to the existing assistant tool discovery directory. It uses the shared blank project starter, imports legacy owner project state through the existing service, checks creation replay before quota, preserves the existing daily project creation limit and legacy ID reservation, stores snapshots through the existing owner registry, and commits with createBuilderProjectState. IDs derive from the authenticated conversation scope, task, and tool call. There is no model-supplied owner identity and no automatic execution or deployment.

Creation, replay, quota rejection, missing mutation identity, and cancellation checks passed along with the existing project tools, 18 tests total. Type checking and production build passed. A browser retry after hot reload returned a Redact SSR error where useMatch had a null router context. Live assistant creation therefore remains unverified, and this renderer/runtime issue must be resolved before declaring the port ready.

### SSR module graph correction

The SSR optimizer was prebundling the Router/Query bridge while other shared router modules remained live. Added the existing routerSsrPackages group to SSR optimizeDeps.exclude so shared provider and consumer modules remain in one graph. Optimizer metadata no longer lists the bridge. The signed-in page rendered again, then survived a real assistant server-module edit and browser reload. Type checking passed. A live normal-language create-project request was submitted after that reload; its final result still needs verification.

### Shared project listing and live creation follow-up

The assistant now lists projects through the original `listOrImportBuilderProjectStates` service, the same service used by the project picker. This preserves visibility of existing Builder projects instead of making assistant discovery depend on whether another UI has imported them first. All 18 focused assistant project tool checks passed.

The SSR module-graph production build passed. The subsequent real signed-in project-creation request ended as interrupted, so live assistant project creation remains unverified. The development log also contains repeated durable-stream cancellation rejections, which still need a root-cause investigation. This is not evidence that the complete port is ready for release.

### Interruption evidence corrected

The repeated `Stream was cancelled` stack is from `postgres/cf/polyfills.js`, specifically its Cloudflare TCP socket reader. It is not a durable chat stream stack. The earlier description of durable-stream cancellation rejections was incorrect. The conversation constructor marks a saved running task as interrupted after a Durable Object restart. Current evidence does not establish that the PostgreSQL socket cancellation caused that restart. Development worker reloads are also present in the log. Avoid suppressing errors or changing interruption recovery without proving causality.

The complete application typecheck passed after switching assistant project listing to the original shared import-and-list service. Builder tool provenance now records the completed panel and partial assistant integration separately from remaining runtime and release work.

### Original Builder package tools connected

TanChat exposes `inspect_project_module`, `search_project_package_resources`, and `read_project_package_resource` through its existing tool discovery. These call the unchanged original `createWorkspaceTools` implementations against an authorized saved project snapshot. No package resolver or resource parser was recreated. Conversation ownership, hidden-file rules, abort checks, source output bounds, and the existing TanStack-only Intent skill policy are preserved.

The application typecheck passed, all 20 focused project-tool checks passed, and the original package-resource tests passed using the repository Node test runner. An initial Vitest invocation for the Node tests failed at configuration startup and was corrected to the documented runner. Live model use of the new tools remains unverified. Runtime upgrades and dependency writes still need their original revision-safe integration before the separate Builder harness can be retired.

### Original runtime and dependency mutations connected

`upgrade_project_runtime` and `install_project_dependency` now call the original Builder tools and save through the same owner, revision, mutation receipt, abort, and snapshot quota checks as file replacement. Runtime configuration is persisted with the workspace, including the original fixed install and start commands. The tools save source configuration, they do not execute installation or start a runtime. The three revision mutations share one commit path.

All 22 focused project checks, 11 original workspace checks, and the full application typecheck passed. The typecheck caught optional-runtime and package adapter issues, both corrected without casts. Live execution of the upgraded runtime and dependency workflows remains unverified. The earlier package-tool typecheck claim was premature, its output later showed the adapter error now corrected.

### Mutation replay and release build follow-up

All 24 focused project checks passed, including exact dependency manifest contents, preserved authored code, and replay of committed runtime/dependency receipts without another snapshot or revision write. The consolidated production build passed after formatting the adapters.

Live Chrome navigation currently shows `ERR_BLOCKED_BY_CLIENT` on the existing localhost test tab, including after reload. The development server remains listening on port 3001. No browser protection was disabled. Live creation, runtime execution, and original Builder route retirement remain pending.

### Committed project changes refresh the picker

The assistant emits the shared `tanstack.project.saved` event after a revision or creation commits, and when a committed receipt is replayed. TanChat handles it through TanStack AI `onCustomEvent` and invalidates the authenticated account project-list query. The existing Builder editor continues to use its own authoritative revision stream. No polling or tool-name inspection was added. Failed commits do not publish a saved event.

All 25 focused project checks and the complete application typecheck passed. Added checks prove that a rejected revision produces no refresh event and a successful commit does. The actual browser refresh behavior remains unverified while the local browser check is blocked.

### Initial appearance payload source port

The original `appearance-html.ts` payload implementation is now present unchanged under chat/server. Wiring is unfinished. A direct port of the old HTMLRewriter middleware does not fit the shared host server types and TanStack auth identity, so that attempted middleware was removed. The shared document/rendering integration still needs to be implemented without recreating the source palette logic or adding a host-specific global shim. No initial-paint verification is claimed.

### Shared initial appearance integration

The original appearancePayload implementation is now called by a server-only shared-session adapter, using TanStack AuthUser.userId and the shared PostgreSQL account preferences. The /chat route loads that payload and renders the original appearance bootstrap through its route head before body content. Personalized chat documents use private/no-store browser and CDN cache headers. This avoids adding a Cloudflare HTMLRewriter shim to the shared server.

The full application typecheck and eight focused appearance checks passed, including original resolved palettes and script-delimiter escaping. Production build verification is running. Visual first-paint verification remains pending, file presence and payload checks alone do not prove it.

The production build for the shared initial appearance integration completed successfully. Live visual verification remains pending.

### Broad regression verification

The current destination worktree passed `pnpm run test:chat`: 204 files and 2,050 tests. It also passed `pnpm run test:unit`: 507 passing tests, two skipped, zero failures. These cover the ported harness contracts and existing site unit behavior, not a complete live product or deployment audit. Shared auth sign-out uses full document navigation, so the old document and in-memory loader state are discarded.

Remaining release requirements still include real project creation and editing through the assistant, upgraded runtime execution, OAuth and MCP connections, original Builder harness retirement and redirects, Electron runtime/release verification, and production infrastructure deployment. No goal completion or live readiness is claimed from the regression suites.

### Cloudflare deployment dry run

Wrangler 4.103.0 successfully completed deployment dry-run validation of the current production build, without uploading. The built worker has the StreamObject, WorkspaceSync, Conversation, TanChatWorkflow, storage, AI, and static asset bindings. It contains 899 modules and 1,024 client assets, with 8,577.56 KiB compressed worker upload size. This is package/configuration evidence, not proof of production startup, provisioned Durable Objects, secrets, OAuth, or a successful live deployment.

The R2 inventory command required explicitly selecting the configured TanStack account in this multi-account login. No reauthentication or infrastructure mutation was performed.

### Project selection is a typed chat destination

The shared workspace search schema now accepts an exact project UUID. The Projects panel reads and updates that destination through the existing router instead of keeping the selection only in component state. Selection changes still flush pending editor changes before navigating. Hiding the panel preserves the project destination, invalid project values are discarded, and the existing server owner checks still control access. This provides a destination for eventual Builder project redirects, those redirects are not yet enabled.

The complete application typecheck and 22 focused panel/navigation checks passed. Live reload and navigation verification remain pending. The CI deploy script already reaches chat schema validation through db:prepare-builder, so no redundant release script was added.

### Authenticated project entry route

`/chat/project/<project UUID>` now resolves the shared authenticated personal workspace and assistant, then redirects into the existing Projects panel with the exact project destination in typed search state. Anonymous users retain this destination through the existing login returnTo flow. Invalid UUIDs produce not-found. The project editor remains the original Builder component and backend.

Production build and generated route registration passed. Original Builder routes remain pending retirement, including a separate decision for public project viewing, and the new entry flow still requires live browser verification.

### Public snapshot viewer under chat

`/chat/p/<hash>` ports the existing public Builder snapshot route, with the same SharedExamplePage, client-only runtime boundary, and WebContainer headers. It does not force public viewers into the personal workspace login flow. The shared viewer uses project terminology for its run and error labels. The generated route and production build passed before the copy-only label change. The prior authenticated project entry typecheck completed successfully.

The old public Builder snapshot route is still available until live runtime verification and redirect activation. This addition preserves the public-viewing requirement rather than silently narrowing consolidation to signed-in owners. Visual checks and WebContainer execution remain pending.

### Shared snapshot endpoint mismatch repaired

The original share helper still posted snapshot JSON to the newer project-record endpoint, and the public viewer fetched a project record where it expected snapshot JSON. Sharing now reuses the existing storeBuilderProjectRevision snapshot client, and viewing reuses getBuilderProjectSnapshot. Large shares return /chat/p/<snapshot hash>; small compressed fragment shares use /chat/shared without an upload. The existing encoding, snapshot parser, storage quotas, and authentication remain in use. No replacement storage implementation was added.

The production route build and both sharing contract checks passed. Checks cover inline encode/decode and large-share storage routing. The full typecheck is running, and live UI/viewer verification remains pending.

### OAuth completion across browser isolation

AuthPopupForm now creates a unique BroadcastChannel for each OAuth attempt and submits its UUID with the existing same-origin request. The Kody connect handler stores it in the encrypted pending payload, and the callback validates and uses that saved identifier after the existing state, cookie, PKCE, token, and shared-session checks. Completion still only invalidates authenticated bootstrap data; no token is sent through the channel. Existing opener postMessage completion remains available. The closed-window polling was replaced by the pending attempt expiry timeout, because COOP can detach a still-open popup. WebContainer isolation is not yet enabled for chat, live completion still needs verification.

Four focused completion/sharing checks passed. The earlier sharing typecheck found that the original snapshot client returns a hash string rather than an object. Its caller and mock were corrected; the final typecheck is running.

### Shared login isolation approval boundary

Inspection found a second opener dependency in the shared Google/GitHub LoginModal flow. Enabling COOP for chat before fixing it could break modal login. The proposed change carries a unique completion channel through the existing OAuth popup cookie and callback, then invokes the existing modal completion callback. Existing state, session, and returnTo validation would remain.

Automatic approval review rejected the attempted shared-auth update before the command ran, citing substantial authentication disruption risk and missing explicit authorization for that implementation. No shared OAuth edits were applied. User approval was requested. Chat isolation and the dependent WebContainer live checks remain pending. Other consolidation work is still possible, the full goal is not blocked or complete.

### Desktop package artwork

The ported Electron Builder configuration now reuses the existing 600 by 600 TanStack logo from the website instead of packaging the Kody koala. The historical assets remain attributed and are not active package inputs. This is a packaging change, not evidence of a signed or notarized release.

### Desktop host verification and packaging gap

Rebuilt the original native folder helper and reran all 17 ported desktop tests, all passed. Coverage includes account isolation, folder grants, authentication popup isolation, multi-window IPC ownership, update lifecycle, and the consolidated /chat launch path. The unsigned package command failed before packaging because electron-builder is not installed. The site pnpm workspace currently includes only the root package, leaving desktop dependencies outside the installation and lockfile. Desktop workspace/install integration still needs to be completed before packaging and live launch can be verified.

### Desktop workspace integration

Added desktop to the existing pnpm workspace and shared lockfile. Inspected electron-winstaller install script, it copies its bundled architecture-specific 7-Zip executable and DLL, and explicitly allowed it in the existing allowBuilds policy. pnpm install completed successfully. The local pack command progressed through Electron 44.4.5 download, native dependency rebuilding, app assembly, and signing with an available Developer ID identity. Although forceCodeSigning=false permits unsigned builds, Electron Builder automatically discovered a signing identity. Process session 44119 was still running at the latest observation, packaging completion and notarization are not yet proven. No package has been published.

### Desktop package assembled

The same local pack process completed with exit 0. Inspected the actual app Info.plist: TanStack name and executable, com.tanstack.desktop bundle identifier, version 0.1.3, and generated icon.icns. Inspected app.asar with the installed Electron archive reader: main.mjs entry, original preload.cjs and connected-device.mjs are included, and runtime-config.mjs launches https://tanstack.com/chat. nativeUpdates=false for this package because no update host was configured. Electron Builder explicitly skipped notarization because notarization options could not be generated. This package is not a verified distributable release and has not been published.

### Legacy chart playground capability

Inspected /builder fragment behavior before redirecting: #project loads the shared project viewer, #code loads the existing ChartsBuilderPage, and ordinary /builder loads the old harness. Added /chat/charts using the exact existing ChartsBuilderPage component and original browser runtime headers, no replacement chart implementation. The original fragment encoder and decoder remain unchanged. Old /builder routes are not yet redirected, public preview isolation and shared authentication still need coordinated verification.

### Desktop development and test commands

Added root dev:desktop, pack:desktop, dist:desktop and test:desktop commands, and included desktop checks in the existing repository test pipeline. The desktop dev command now invokes the declared Electron package’s own install-electron CLI before launch, since Electron 44 has no automatic postinstall download. The installer completed successfully and all 17 desktop tests passed through the new root command. Added desktop/README.md with actual development, packaging and release configuration. Live application sign-in and browser interaction remain unverified.

### Database lifetime investigation

Current shared database code creates one lazy Postgres.js pool per AsyncLocalStorage context in Cloudflare, with up to five connections, and retains the context in asynchronous descendants. Conversation.runWithRuntime wraps RPC operations, but trackExecution and kickQueue also schedule work directly with the Durable Object waitUntil context. Closing the pool immediately when the RPC function returns would race that continuing work, so a blanket finally/client.end change is not justified.

The checked-in Wrangler configuration has no Hyperdrive binding. The shared host resolver supports Hyperdrive, but currently falls back to DATABASE_URL. Cloudflare’s documented automatic connection cleanup applies to Workers-to-Hyperdrive connections, not proof that this direct Neon socket lifecycle is correct. Its Durable Object guidance also warns against long-lived idle database clients. Next verification needs to distinguish direct connection teardown errors from worker reload cancellation, and cover a response that finishes while its background execution continues before changing shared database lifecycle code.

Sources: https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/ and https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/

### Database context boundary checks

Added four checks against the actual shared db/client module with mocked transport: lazy invocation without queries, nested client reuse, concurrent invocation isolation, and asynchronous descendants continuing after the request callback returns. All four passed. This confirms why request-return cleanup alone would be unsafe. These are context ownership checks, not live socket teardown proof, no connection lifetime implementation was changed.

### Shared site navigation entry points

The full repository test:tsc command completed with exit 0 before this navigation-only edit. Both existing authenticated account menus previously sent users to the old /builder harness under My Projects. They now link to /chat as TanChat using the existing Phosphor chat icon. The old Builder routes remain available until capability retirement checks pass. Rendered menu verification is still pending because the prior browser test was blocked by Chrome.

### Shared lint gate audit

The existing type-aware lint gate failed with 275 errors and 101 warnings. The passing main TypeScript check excludes harness-tests and scripts, so it did not establish those files were correctly integrated. Twenty-nine diagnostics referenced the removed source global Env type. Corrected the provider observation adapter test to import its actual ProviderEnv contract from the ported providers module. The remaining lint diagnostics still need fixes, the release gate is not passing and has not been suppressed. Browser verification was retried against the running localhost:3001 server and Chrome again returned ERR_BLOCKED_BY_CLIENT before page load.

### Ported test environment repairs

Removed references to the old global Env from execution gate, MCP public egress, Jev routing, Kody run tools, Kody memory tools, Kody setup readiness and Kody memory creation tests. Optional environment settings use the actual narrow exported contracts, and Kody fixtures provide the required origin and encryption key instead of casting empty objects. All 41 checks across these seven files passed. This fixes test integration without weakening lint rules or adding a global compatibility type. Other lint failures remain.

### Desktop lint integration

Converted the ported Electron Builder configuration from CommonJS to ES modules, reusing the same configuration and release validation logic. Updated package commands, verified config import and native helper build, and excluded the build-only config from app.asar. Removed an unused counter from the original mocked device test. All 17 desktop tests passed again. The PostgreSQL verifier still has real type errors in its fixtures and row handling, no blanket exclusions or lint suppression were added.

### File storage fixture contract repairs

The PostgreSQL verifier’s R2 mock omitted the required checksum toJSON method. Updated it to use the installed Cloudflare R2Checksums contract and serialize the computed digest. Focused lint confirms its three storage contract errors are gone, 65 other verifier errors remain. File HTTP tests now supply a valid FileEnvironment and the current content result arrayBuffer method instead of the old global Env and incomplete content mocks. All seven file HTTP boundary checks passed. No live database verification was rerun against a production account.

### Verifier fixture narrowing

Repaired MCP fixtures to include content alongside structuredContent, removed casts on their call functions, preserved the required model connection when updating Kody credentials, asserted the existing Kody account before modifying it, narrowed an unknown skill result before reading ok, and encoded a plugin package as a JSON string parameter with PostgreSQL jsonb conversion. Focused lint dropped from 65 to 58 errors before the final analogous MCP fixture repair. The database verifier was not executed, its runtime behavior and remaining type failures still need verification.

### Verifier TypeScript project

Added scripts/tsconfig.verify.json covering all chat consolidation verifiers and the original Builder schema verifier, with the actual shared aliases, ambient declaration files and generated router types. Initial checking exposed real missing credentials, incomplete activity projections, un-narrowed reference unions and incomplete mocked MCP results. It also exposed missing ambient declarations in the verifier project, corrected its includes rather than adding compatibility globals. The activity fixture now uses the original projectBotActivity function to produce its required fingerprint and message bookkeeping. This project is not yet passing or wired into the release pipeline.

### Consolidation verifiers type check passes

All chat database consolidation verifiers and the original Builder schema verifier now pass TypeScript checking together, exit 0. The project uses the standard scripts/tsconfig.json filename so tools can discover its real declarations. Added this check to the existing root test:tsc command, which is already part of CI. Fixed Kody credential fixtures to carry their required included connection, narrowed reference kinds before specific fields, supplied complete MCP responses, and typed deferred results with the real kodyCall return contract. This is compile-time verification, actual isolated database runs and full lint remain separate gates.

### Real local PostgreSQL verification

Ran all three native database verifiers against separate, empty PostgreSQL 17 databases on a task-owned loopback-only cluster. The Kody refresh and project edit verifiers passed. The full workspace verifier initially failed because its manually inserted plugin preview fixture used an already serialized string as an inferred JSONB parameter. PostgreSQL.js encoded that string again. The fixture now declares the serialized parameter as PostgreSQL text before the explicit JSONB conversion, including the equivalent retry source fixture. This changes verifier inputs, not production package parsing.

The complete workspace verifier then passed against a new empty database. Evidence: `/private/tmp/tanchat-workspace-live-verify2.log`, `/private/tmp/tanchat-refresh-live-verify.log`, and `/private/tmp/tanchat-project-live-verify.log`. These checks cover native persistence and concurrency contracts. They do not prove rendered UI behavior, live model execution, production deployment, or the pending shared OAuth changes.

### Ported test contract follow-up

Removed the remaining old global `Env` casts from the model selection and attachment test fixtures. They now use the native `ModelEnvironment` and `AttachmentEnvironment` contracts. The deliberately missing model case remains covered as an explicitly invalid runtime input. The offline worker test now declares its fetch event contract instead of using `Function`. Focused verification passed: 39 model-selection checks, 11 attachment checks, and the offline navigation/cache boundary check. This does not establish that the entire repository lint gate is clean.

### Legacy project entry points

The old `/builder/p/$hash` route now redirects to `/chat/p/$hash`, preserving the public snapshot hash and reusing the original shared viewer already mounted there. The old `/builder/$id` route now redirects to `/chat/project/$projectId`, which opens the project in the assistant's project panel through the existing shared sign-in flow. Both use history replacement. The root fragment-based Builder links and template creation entry point still need their own migration before the entire old harness can be removed.

The `/builder` root now redirects into TanChat. Its original `#project=` snapshots are preserved at `/chat/shared`, and original `#code=` chart payloads are preserved at `/chat/charts`. The ordinary index opens `/chat`. The route remains client-only so URL fragments are available before choosing the destination. This removes the old Builder index from the root entry point, while the original viewer and chart components continue to handle their payloads. Type verification for the earlier project and snapshot redirects passed; verification of this additional root change is in progress.

The Builder root redirect TypeScript check passed. TanChat's project panel now offers the existing Builder template catalog, using `createBuilderProjectFromTemplateId` and the same `createBuilderProject` save API. It preserves the existing save-before-switch behavior and does not introduce a second project creation backend. Type verification for this panel change is running. The old draft page and its separate assistant are still present pending full retirement; rendered validation is also still required.

The project panel template integration passed TypeScript verification. The old `/builder/ai` standalone assistant entry point now redirects to `/chat`, using TanChat's conversation engine. The original Builder project draft/template tests also passed. The old draft route, old assist API, and unused assistant implementation still need removal or consolidation after their remaining callers are accounted for.

### New project entry consolidation

`/builder/new` now redirects to `/chat/new-project` with its template query preserved. The new route uses TanStack's existing current-user and login-return flow, then opens the assistant's Projects panel. Template selection lives in the existing workspace navigation state, so an already mounted panel receives the selection correctly. The user confirms creation with the panel's New project button, which uses the original template constructor and project save API. This changes the old local-draft-first entry experience to the consolidated saved-project flow. No existing user draft migration is promised, consistent with the fresh-data scope. The old draft and standalone AI pages are no longer routed, but the old assist API and unused code still require retirement. Rendered verification remains pending.

### Old assistant endpoint retirement

Removed the old model execution loop from `/api/builder/assist`. It now returns HTTP 410 with the TanChat destination, rather than preserving a separate executable harness or pretending the two wire protocols are interchangeable. The original request parser, validation helpers, and BYOK boundary were moved unchanged into `builder-ai-request.server.ts`; their existing tests now import that module. Remaining dead Builder assistant UI code still needs pruning, but the old API can no longer invoke a model.

The reused project editor's fallback fork navigation and Back links now point directly to TanChat, rather than sending users through legacy redirects. All 17 workspace navigation checks passed after the template search-state addition. Type and focused lint checks for the latest retirement changes are running; live browser verification remains pending.

### Current browser and shared OAuth verification limits

Rechecked the live local renderer, which is listening on localhost port 3001. Chrome still rejects navigation with `ERR_BLOCKED_BY_CLIENT`; no browser protections were changed or bypassed. The full TypeScript check following old assist API retirement passed. A new Cloudflare production build is running to verify the replacement routes and bundles.

The shared OAuth completion-channel implementation was attempted once after approval evidence arrived from the sibling chat. Automatic approval review rejected execution because that evidence was tool-delivered rather than a direct user message in this chat. None of the proposed shared OAuth edits ran. A direct confirmation is pending here. Other consolidation work continues.

The Cloudflare production build after Builder route and API retirement completed successfully. Evidence: `/private/tmp/tanchat-builder-retirement-build.log` and the current `dist/server/index.js` artifact. This proves compilation, not deployment or live sign-in.

The project editor no longer imports the old Builder assistant at runtime or offers its alternate chat view. TanChat retains the original workbench and project synchronization. Historical sync type imports remain, and now-unused assistant transaction helpers still need cleanup. Type verification of this additional editor change is running.

Removed the old assistant's now-unreachable apply/validate/commit/restore transaction helpers and their state guards from the reused project editor. The ordinary save queue, working-copy recovery, pending save receipt handling, external revision conflict detection, and synchronization hydration remain. Focused type-aware lint reports zero warnings and errors. The original bootstrap, working-copy, sync outbox, and sync client test suites passed. Full TypeScript verification of this cleanup is running.

Removed the four unrouted old harness UI files: BuilderAssistant, BuilderAiSpike, BuilderIndexPage, and BuilderProjectDraftPage. Each was clean in Git before removal, and searches found no remaining callers after replacing the project editor's last type dependency. The retained editor's live subscription now reads only the project row and invokes the existing reconciliation handler, instead of assembling unused assistant thread/message/run arrays. Focused type-aware lint passed. Full TypeScript verification is running. Original source remains recoverable in Git, but these old UI implementations are no longer part of the current application.

Type verification after removal of old assistant UI is still running on the original process handle. The final ESM Electron packaging configuration is now being exercised by an unpublished local package build; the earlier package was built before this configuration rename, so it was not sufficient evidence for the final configuration.

The full TypeScript check after removal of the old assistant UI completed successfully. The final Electron packaging run has reached Developer ID signing, with publishing disabled; package completion and signature verification are still pending.

The final ESM Electron package build completed successfully with publishing disabled. Developer ID signing completed, and strict deep signature verification passed for `dist/desktop/mac-arm64/TanStack.app`. Its display name is TanStack and bundle identifier is `com.tanstack.desktop`. Notarization was explicitly skipped because credentials were not configured. This is a verified local signed package, not a notarized public release or a tested live desktop session.

The complete repository lint gate currently reports 100 warnings and 165 errors. Renamed the server's `usePlugins`/`usePlugin` locals to `activatePlugins`/`activatePlugin`, because these are asynchronous activation functions, not React hooks. Public tool names and execution behavior are unchanged. Focused server lint now has no errors, with four remaining unused-code warnings. Also corrected immutable schedule result and preview bindings. The broad gate is still incomplete.

Connected the ported Location, Running process, and Repeat labels to their real SelectField triggers using component-scoped React IDs. The schedule kind callback now accepts only the three supported choices instead of casting an arbitrary string. Focused lint confirms the form-label errors are resolved; the schedule form's existing autofocus issue remains, so this is not a claim that all UI accessibility lint is clean. Rendered validation remains blocked by Chrome's localhost restriction.

### Harness test type coverage

Added `harness-tests/tsconfig.json` for the original ported core tests and included it in the root `test:tsc` command. The ordinary app typecheck explicitly excludes this directory, so successful test execution previously did not establish that its fixtures matched native contracts. The new check uses the same strict application settings and source declarations, with a separate incremental cache. Its first complete run is in progress, and any failures remain part of the consolidation gate rather than being hidden by exclusions.

The first strict harness test type run found 121 errors. One exposed a genuine coverage gap: Vitest's workflow `it.each` rows spread the graph's steps as individual callback arguments, but the callback treated the first step as the whole graph. Those cases rejected the wrong shape rather than proving graph validation. The table now wraps each graph as a named object, preserving every original case while passing the intended steps array. All 11 workflow checks pass with the corrected fixture. The remaining type errors are still part of the active gate.

Corrected the project tool tests to require actual executable handlers from the original factory, instead of assuming optional framework fields exist. Delegation tests now require a real converted input schema. The discovery test mock declares the record input it checks, and the Kody run fixture includes the required MCP content array without a cast. All 39 focused checks across those four files pass. Strict verification is rerunning against the full harness test project; remaining errors are not yet cleared.

Preserved the original project's ordered tool tuple in tests rather than mapping it into a union of incompatible handlers. Each invocation now requires its own actual handler, keeping that tool's input signature. The Kody memory factory now declares its existing search/read ordering as a typed tuple without casts, and the stopped-message fixture carries the required tool-result state. All 30 focused project, memory, and message-history checks pass. Strict test type verification is rerunning; no full-gate success is claimed yet.

### Project tool fixture contracts

The carried-over project tool tests now supply the installed TanStack AI custom event callback and use the original workspace version constant. All 25 project tool tests pass, including ownership, cancellation, revision conflicts, receipt replay, and refresh only after commit. The dedicated harness TypeScript check still reports other incomplete test contracts, so this is not full verification of the port.

### Table-driven contract verification

Fixed array spreading in the original plugin disclosure and malformed retry request test tables. Each case now receives the intended complete tool list or message-part array. The workflow definition fixture goes through the original definition schema. Plugin and workflow checks pass all 8 cases, and retry restoration checks pass all 23 cases. These three test files have no remaining dedicated harness TypeScript errors. Broader port verification is still incomplete.

### Browser execution protocol fixtures

The original browser execution tests now provide explicit acknowledged event positions, complete unconfirmed shutdown errors, and spawn timeouts. Creation fixtures retain their exact command type and history maps accept string session IDs. All 159 tests across HTTP, owner lifecycle, and execution history pass. The dedicated harness type check reports 60 remaining errors after this batch, including obsolete SQL fixture types. These checks do not prove live browser execution or shared OAuth completion.

### Usage and MCP callback verification

Gateway assertions now use the native Headers API, and estimated Jev cost assertions narrow the actual billing status. All 13 usage tests pass. MCP transport authorization and stored-result routing mocks now use their actual callback contracts, with all 13 affected tests passing. Shared implementation behavior was not replaced. Remaining strict harness errors still prevent claiming the full verification gate is green.

### Distinct delegation tool contracts

The original delegation factory now retains each of its five tool schemas as a typed tuple, preventing unrelated argument contracts from intersecting when selecting a tool by position. Tool descriptions, runtime parsing, stable command identities, and access behavior stay the same. All 6 delegation and selected-source tests pass, including rejection of model-supplied authority fields. The provider credential tests also pass all 3 cases for key preservation, included access, and restricted providers.

### Scheduling and selected-context fixtures

All 58 scheduling, timezone schema, and selected-context tests pass with complete scheduled-run timestamps and explicitly typed malformed source identities. The original system-one research loop passes all 9 cases with candidates using its real source-action contract. These are carried-over behavior checks, not model efficacy tests.

### Full carried-over harness verification after contract corrections

The full harness suite passes 207 files and 2,061 tests after the contract corrections. Cloudflare storage fixture types are explicitly imported instead of depending on ambient globals. The conversation HTTP reader declares its two actual asynchronous methods, preserving unbuffered live stream responses and headers; the six reader and workspace boundary tests pass. The dedicated strict harness type check still reports 18 errors. This proves automated harness behavior coverage, not live authentication, browser runtime execution, production deployment, or full consolidation completion.

### Kody inventory and generic MCP discovery contracts

Kody metadata test callbacks now return unknown transport data, allowing the original inventory parser tests to cover incomplete and varied response shapes without tying every mock to the first fixture. All 13 inventory tests pass. Generic discovery and catalog mocks use their actual callback types, with all 41 affected tests passing. No task-specific routing was added.

### Remaining strict test boundary cleanup

Package detail tests now narrow unknown results before mutation, package access mocks use the real account state union, SQLite publisher inputs use native SQLInputValue, and mixed admission operations retain a void transaction callback. All 25 affected tests pass. Strict harness verification still has incomplete fixtures to resolve, including transcript copies, nested thinking, and middleware abort context.

### Strict harness gate passes

The dedicated harness TypeScript project now passes with no errors. The complete harness suite still passes 207 files and 2,061 tests after all fixture corrections. Transcript fixtures retain their exact source types, malformed nested reasoning remains explicitly rejected, memory operation identity is checked from actual object data, and middleware abort metadata matches the installed API. The combined application type gate was still running when this entry was recorded. Live authentication, browser runtime execution, deployment, and complete consolidation remain unverified.

### Combined application types pass

The complete test:tsc command passes: application types, builder evaluation scripts, native database verifiers, and dedicated harness test types. The full lint gate currently reports 36 errors and 100 warnings. Model reasoning, workspace session history, and workflow selectors now have explicit label/control associations using React useId and the existing SelectField API. Live authentication, rendered UI verification, production deployment, and full consolidation remain unfinished.

### Unported conversation runtime fixture gap

The original tests/fixtures/conversation-runtime.ts uses D1 migrations, D1 request bindings, and local SQLite Durable Object state. The pending retry-source runtime test has no matching fixture in the destination and is outside the passing core harness suite. It needs an actual PostgreSQL host fixture while retaining original local Durable Object state behavior, not a D1 compatibility shim or test exclusion. This is required evidence before claiming full conversation runtime parity. Sidebar selector labels also gained stable React control IDs.

### Sidebar controls and copy decoder cleanup

Parent conversation, sidebar section, and default display checkbox labels now point to actual shared UI control IDs. Focused lint no longer reports label association or decoder declaration errors in the affected files, though other sidebar lint failures remain. The copy protocol retains one immutable fatal UTF-8 decoder; all 32 retry evidence copy tests pass. The original conversation runtime fixture was inspected against the native PostgreSQL verifier setup, and its D1 setup still needs replacement before enabling the pending runtime tests.

### Original conversation runtime fixture port started

Added harness-tests/pending-runtime/fixtures/conversation-runtime.ts by porting the original Gum fixture. Its Durable Object state, reconstruction, transaction helper, and real Conversation calls remain from source. Account and conversation setup now uses native PostgreSQL, guarded to local databases named tanchat_test. The original D1 adapter and migrations are removed. This fixture has not run yet: pending runtime tests still need their direct D1 database mutations converted to PostgreSQL, and a migrated dedicated local test database must be prepared. It is not counted as passing runtime evidence.

### Real conversation retry runtime verification passes

The original retry-source runtime test file now uses native PostgreSQL queries and UUID account identity. Against the task-owned migrated local PostgreSQL database, all 10 tests pass through the actual Conversation object with original local SQLite Durable Object state and reconstruction. This covers settled inputs, archived evidence, revoked access during capture, deleted sources, successful file references, reset during capture, and late approval outcomes. The fixture reset uses TRUNCATE users CASCADE on a guarded local tanchat_test database. A separate failure was observed when deleting the fixture account: a sync trigger attempted to publish into chat_workspace_sync_clock after its referenced workspace was deleted. Account deletion needs a root-cause investigation. Other pending runtime test files and reproducible database setup still need verification.

## Shared Google and GitHub popup completion

Implemented following direct approval. Each popup attempt has a random completion channel bound to the verified OAuth state through the HttpOnly popup cookie. Completion uses BroadcastChannel with same-origin opener messaging as a fallback, and the login modal fetches the server session before closing. Existing provider, OAuth state, account and session checks remain in place. Cancellation and replacement attempts dispose their listeners, duplicate completion signals are ignored, and popup-blocked fallback still uses full-page login.

Validation: seven focused tests passed, root and strict harness TypeScript checks passed, and eleven changed auth/test files passed type-aware lint with zero warnings or errors. Live provider login remains unverified because Chrome blocked http://localhost:3001/chat with ERR_BLOCKED_BY_CLIENT. No browser protection was bypassed. Not deployed.

## Native PostgreSQL cascade lifecycle fix

Migration 0038 replaces sync and membership lifecycle trigger functions. Cascading workspace deletion skips sync-clock updates after the workspace is gone, and cascading user/workspace deletion skips execution-generation inserts when either parent is gone. Normal membership revocation still advances its execution generation. No exceptions are swallowed.

Verified harness-tests/postgres/cascade-lifecycle.sql against the dedicated local migrated PostgreSQL database with ON_ERROR_STOP: membership revocation, workspace deletion and account deletion all passed, and all test records rolled back. Migration has only been applied to the local test database, not production. Full consolidation and live login verification remain incomplete.

## Expanded original conversation runtime verification

Ported the original loaded-assistant-tools fixture and conversation-progress tests from Gum, preserving actual tool discovery, executors and authorization. Adapted identity to the native UUID fixture and repaired the test R2 object to expose its actual arrayBuffer contract. All three runtime files now pass, 17 tests, against dedicated local PostgreSQL. Coverage includes retry recovery, repeated validation failures, unchanged save/read/list loops, changed file content, receipts and persisted progress. Model responses and external storage are scripted test fixtures, this is not live provider or Cloudflare parity. Runtime fixtures still need strict typing and reproducible database setup before joining the default gate.

## PostgreSQL runtime PR gate

Added a separate PostgreSQL 17 service job to the existing PR workflow. It creates the explicit minimal existing-site boundary (users UUID key and showcase status), applies the complete production migration history using pnpm run db:migrate, runs the rolled-back cascade checks, then runs pnpm run test:chat-runtime. This baseline is only for isolated chat tests, it does not represent or verify the complete site authentication schema.

Verified locally against fresh tanchat_test_ci_0930: complete migration history succeeded, cascade checks succeeded, three runtime files and all 17 tests passed. The GitHub job itself has not run and deployment remains outstanding.

## Current release lint audit

Full lint gate reported 20 errors and 100 warnings. Fixed three concrete failures: settings AI connection label now uses an associated control ID, browser execution setup timer uses a single const declaration, and the progress test digest uses an owned ArrayBuffer. Focused lint on those files has zero errors and two existing warnings. Actual browser execution bridge suite passes 25 tests. Remaining full-gate failures include autofocus patterns, keyboard/accessibility handling, Electron CommonJS preload rule mismatch and an unsafe test Function cast. No broad lint suppression added. Release gate remains incomplete.

## Editing focus and preload gate fixes

Queue and thread-title editors now focus via explicit edit-state transitions rather than DOM autofocus attributes. Inline rename keyboard events are isolated from the containing conversation row. Electron sandbox preload stays CommonJS, with a file-specific no-require-imports exception only for desktop/preload.cjs. Root TypeScript passed. Focused lint for the queue editor, thread editor and preload passed with zero warnings/errors. These focus interactions still need rendered browser validation, local Chrome access remains blocked. Other full release-gate failures remain unresolved.

## Current Cloudflare bundle verification

A fresh build caught the shared login context importing oauth-popup.client.ts into the server environment. Fixed the actual environment boundary with TanStack Start createClientOnlyFn, keeping import protection enabled. The complete pnpm run build:cloudflare command now exits successfully. Root TypeScript and seven focused popup tests also pass. Octane node-module externalization warnings remain and require live browser execution validation. Successful build is not a deployment or proof of production binding/auth parity.

## Updated source and full harness audit

Current full harness suite passes: 208 files, 2068 tests. Refreshed source coverage from the actual Gum and TanStack trees. All 107 core and 9 client files are present. 219 of 220 component paths are present, the removed SignIn component is replaced by shared TanStack login. Five old server paths are replaced by shared auth, native workspace identity, split API routes and shared host runtime. The coverage record now names those replacement paths explicitly. File presence does not prove behavior, and live auth/provider/Cloudflare checks remain incomplete.

## Gateway proxy type and receiver verification

Removed the production gateway run function cast and test binding/Function casts. The proxy now retains the concrete input binding type and invokes run with Reflect.apply and the native receiver. Strengthened the existing privacy test to assert original return identity and property forwarding alongside the payload logging header. Root TypeScript passes, focused lint has zero warnings/errors, and all 13 usage tests pass. No live provider request was made in this verification.

## Sidebar editor focus contract

Shared Modal now exposes the native Base UI Dialog.Popup initialFocus property. Conversation editing passes its name-input ref through that contract, retaining primitive-managed focus trapping and restoration. Section editing focuses only when the selected edit identity changes. Removed both sidebar autofocus attributes. Root TypeScript passed. Rendered keyboard/focus validation remains incomplete because local browser access is blocked.

## Palette and schedule focus release fixes

Refreshed full lint after prior fixes: ten errors remain, mostly autofocus plus scroll-region accessibility configuration. Command palette now uses its existing Base UI initialFocus contract on opening and an explicit page-depth transition to focus replacement inputs; removed redundant autofocus attributes. Schedule editor focuses the name field when its editor mounts. Root TypeScript and focused lint passed, and all 12 command-palette contract tests passed. Contract tests do not prove rendered focus, browser testing remains outstanding.

## Integration form focus release fixes

Connection setup name focus follows custom-form entry; disconnect and plugin-removal confirmations focus Cancel on their respective state transitions. Removed three DOM autofocus attributes while preserving safe default actions. Root TypeScript passes and focused lint reports zero errors, existing hook dependency warnings remain. Live keyboard focus verification is still outstanding.

## Skill/reference focus and remaining lint gate

Reference detail back buttons focus on detail-view entry, and skill editor name focus follows editable-field entry, including returning from preview. Removed the final three autofocus attributes. Root TypeScript passes. Full lint now reports 100 warnings and one error: the saved-file diff scroll region uses tabIndex for keyboard scrolling. An attempted roles allowlist did not affect the rule and was removed, no ineffective configuration retained and keyboard access remains intact. This last accessibility rule conflict remains a release blocker, along with live verification and deployment.

## Complete project test gate passes

Resolved the final lint error using the supported ARIA region allowlist in a correctly matching \*\*/SavedFiles.tsx override, retaining tabIndex and keyboard scrolling. The earlier literal path did not match this override. The complete pnpm test command exits zero: root/script/harness TypeScript checks, full lint (100 warnings, zero errors), 208 harness files with 2068 tests, 507 executed site unit tests with two skipped, and 17 desktop tests. This is the first current combined-gate result after shared popup, native runtime and focus fixes. PostgreSQL runtime CI job remains a separate check. Live provider/auth/browser execution, production deployment and feature-by-feature completion are still unverified.

## Production secret preparation

Read actual tanstack-com secret names using Wrangler 4.103.0. Shared DATABASE_URL, SESSION_SECRET and Google/GitHub OAuth credentials exist. ENCRYPTION_KEY was absent, which prevents chat bootstrap. Direct secret update was refused because the latest Worker version was not deployed. Used the supported versioned-secret command to prepare a new random encryption key without printing or retaining its value locally. Cloudflare confirmed version 0eed8adb-4c7d-4b81-a57b-f6fcdeb2d536 contains ENCRYPTION_KEY. This version is not deployed and traffic was not changed. The checkout remains a sibling task branch with shared uncommitted work, no Git state changed.

## Production migration verification

Compared the shared Neon migration ledger against the checked-out journal and SQL hashes. Production matched 0037_tanchat_kody_oauth exactly, with only 0038_tanchat_cascade_lifecycle pending. Applied the existing migration through Drizzle. The Builder verifier now confirms the exact 0038 hash, and the chat verifier confirms all 63 required tables and columns. This updates the database only, no Worker version or traffic changed. Live OAuth, provider execution, and the full consolidation remain unverified.

## Cloudflare resource readiness audit

Queried the explicit TanStack account 8da95258a9c70b54c3e2b374a0079106. All three configured R2 buckets exist: tanstack-github-content-cache, tanstack-npm-download-cache, and tanstack-notebook-projects. Saved files reuse the notebook bucket under saved-files/ keys. No Workflows are deployed in this account, so the configured TanChatWorkflow is still a deployment requirement. The included provider sends gateway metadata only when AI_GATEWAY_ID exists, and current configuration has no gateway ID. Native HTTP provider gateway routing also requires AI_GATEWAY_ACCOUNT_ID and AI_GATEWAY_TOKEN. Do not claim gateway cost visibility or workflow readiness from the build alone. No resources or traffic changed during this audit.

## Original provider-attempt runtime tests ported

Copied Gum conversation-provider-attempts.test.ts and adapted imports, native UUID identity, and two database assertions to PostgreSQL. Preserved its original assertions for retries, reconstruction, truncated tool transport, partial prose, absent versus zero usage, and verified discovery completion. The isolated local PostgreSQL runtime suite now passes four files and 26 tests. These use the real Conversation object and provider SDK with scripted transport, not live models. The existing PR runtime job includes the new file through its glob. Stopped the task-owned PostgreSQL server after verification.

## Original durable run lifecycle tests ported

Copied conversation-runs-runtime.test.ts from Gum, adapting native UUID identity and two PostgreSQL mutations while retaining its original lifecycle assertions. Fourteen tests verify queued admission and draining, cancellation, reset deduplication, history authorization, stopped runs, failed providers, and recovery after host loss. The combined suite exposed fixture contamination: chat_daily_usage has no account foreign key and survived TRUNCATE users CASCADE. The guarded local test reset now explicitly truncates chat_daily_usage too, preserving production allowance behavior. All five runtime files and 40 tests pass together. Task-owned PostgreSQL stopped after verification.

## Original continuation runtime tests ported

Copied Gum conversation-run-continuation.test.ts and conversation-schedule-continuation.test.ts, adapting imports and native UUID identity. Preserved six run continuation assertions and the scheduled setup continuation test. These verify durable run and scheduled occurrence identity when setup or approval resumes, using actual Conversation methods and the original controlled external-step boundary. All seven runtime files and 47 tests pass together on isolated PostgreSQL. This is not a live Cloudflare Workflow or external setup test. The task-owned database server is stopped.

## Original schedule runtime and lifecycle tests ported

Copied conversation-schedules-runtime.test.ts and conversation-schedule-lifecycle.test.ts from Gum, preserving their assertions and adapting account identity, policy updates, and archive/delete timestamps to PostgreSQL. Thirteen added tests cover alarms, policy loss, stale queued occurrences, archive/restore lifecycle suspension, and reconstruction. All nine runtime files and 60 tests pass together. The task-owned PostgreSQL server is stopped. This remains local runtime evidence, not deployed Cloudflare alarm or Workflow verification.

## System-one runtime fidelity and remaining source inventory

Copied the original conversation-runs-system-one.test.ts with import and native UUID identity adaptations. All ten runtime files and 69 tests pass together on isolated PostgreSQL, including nine original system-one run tests. External decision and MCP responses remain mocked, so this does not measure live Jev efficacy. Added tanchat-runtime-test-coverage.json from current source files and SHA-256 hashes: 27 original files use conversationHarness, ten are present and seventeen still need porting. Presence is explicitly separate from execution evidence. The task-owned database server is stopped.

## Actual assistant discovery runtime verified

Copied original assistant-discovery-runtime.test.ts, adapting imports, native UUID identity, and the shared PostgreSQL Skills constructor. This suite deliberately excludes loaded-assistant-tools and exercises actual discovery. Both original tests pass: initial authorized skill metadata excludes full instructions until read, and dynamically loaded tools survive approval/reconstruction but reset for a new task. All eleven runtime files and 71 tests pass together. The source inventory now records eleven present and sixteen missing runtime files. Scripted provider transport is still used, so this does not prove live model choices. Stopped the isolated database after verification.

## Transcript paging runtime and deployment hold

Copied the original transcript-navigation-runtime, context-reference-paging-runtime, and reference-cursor-contract tests, adapting imports, native account identity and PostgreSQL setup. All fourteen runtime files and 80 tests pass together. This verifies cursor/reset/reconstruction behavior and real context middleware paging, not browser latency. Updated the inventory, thirteen original runtime files remain missing. Stopped the isolated database server. Received explicit user deployment hold via sibling coordination: no deployment, remote publication, automatic-deploy merge, or cutover until approval after review. No deployment occurred in this turn. Existing local node process 26547 is listening on localhost port 3001, browser access still needs review.

## Local review readiness check

Confirmed Vite process 26547 remains alive on localhost port 3001. An in-app browser navigation to /chat is still refused with ERR_BLOCKED_BY_CLIENT. No browser protections changed. Checked environment presence only: local database, session secrets, Google/GitHub credential pairs, and encryption key exist. Included model is supplied by Wrangler vars, not .env.local. Added tanchat-local-review.md with exact local URL, start command, normal login path, unverified behaviors, and explicit deployment hold. No deployment or credential provisioning occurred.

## Original integration memory review tests ported

Copied conversation-kody-memory-review.test.ts with import and native account identity adaptations. Five original tests verify confirmed saves, uncertain write retry token retention, conflict handling, cancellation, and interrupted write review persistence. The remote Kody write remains mocked, no external writes occurred. All fifteen runtime files and 85 tests pass together. Twelve source runtime files remain missing in the refreshed inventory. Stopped the isolated PostgreSQL server. Deployment hold remains in force.

## Dedicated runtime TypeScript audit started

Added harness-tests/tsconfig.runtime.json to check the ported runtime suite independently. First run exposed missing SqlStorage imports, a missing declared AI binding in the fixture, outdated mocked system-one result fields, an invalid mocked MCP response, and union tool execute typing in reference-cursor-contract.test.ts. Corrected the straightforward fixture/interface mismatches. The reference tool typing and follow-up strict typecheck remain outstanding, so this configuration is not yet added to the required passing gate. No production or deployment changes.

## Strict runtime TypeScript gate enabled

A fresh non-incremental TypeScript check of harness-tests/tsconfig.runtime.json exits zero. Fixed source test interfaces by selecting named reference tools, declaring actual AI binding fixture methods, updating system-one results to events/calls, returning a valid MCP content array, and importing SqlStorage explicitly. Removed the provider environment cast. Added the dedicated runtime typecheck to test:tsc, which the existing pnpm test PR gate executes. Runtime rerun exits zero, exact counts in /private/tmp/tanchat-runtime-typed.log. Existing any casts in the original fixture still require cleanup, strict compilation does not imply their elimination. Stopped isolated PostgreSQL afterward. No deployment.

## Original file copy runtime tests ported

Copied conversation-file-copy.test.ts and adapted imports, account identity, and the storage fixture arrayBuffer/owned-byte contract. Both original exact-byte copy and interrupted publication cases pass. All sixteen runtime files and 87 tests pass together. Eleven source runtime files remain. Incremental TypeScript diagnostics again described old fixture source, so the dedicated runtime configuration now disables incremental checking, matching the verified fresh check. Fresh follow-up is still running, session 46537, log /private/tmp/tanchat-file-copy-types-fresh.log. Stopped local PostgreSQL. Deployment remains held.

## Original native memory runtime tests ported

Fresh file-copy TypeScript check passed. Copied memory-runtime.test.ts, adapting native Memories API, UUID identity, PostgreSQL queries and raw bigint assertions. All seventeen runtime files and 96 tests passed together before the final typed tool-selection cleanup. The strict check identified two ambiguous array-index selections, now replaced by named search_memory/save_memory selection. Follow-up strict check session 26314 is running, log /private/tmp/tanchat-memory-types-second.log, and these last test selections still need rerunning. Ten source runtime files remain. Stopped isolated PostgreSQL. Deployment remains held.

## Original schedule approval tests ported

Memory strict typing and final selected-tool rerun passed. Copied conversation-schedule-review.test.ts with native preferences API, UUID identity, PostgreSQL policy/membership/archive updates, and explicit SqlStorage import. All eighteen runtime files and 115 tests pass together, including nineteen original schedule review tests. Runtime TypeScript library configuration now includes ES2024 for original Promise.withResolvers usage supported by the test Node runtime. Follow-up strict check session 74336 is running, log /private/tmp/tanchat-schedule-review-types-second.log. Nine source runtime files remain. Stopped isolated PostgreSQL. No deployment.

### Response preference runtime source port

Ported the original Gum conversation-response-preferences tests with all nine cases retained. Account preference reads and writes use the native shared PostgreSQL service, and bot purpose is checked in chat_bots. The old D1 preference lookup failure injection now spies on the actual readAccountPreferences service boundary. Continued tasks assert that this service is never reread. The isolated local PostgreSQL runtime run passed all nine tests. Model transport remains scripted, this does not prove live provider or browser behavior. Runtime source inventory now contains 19 of 27 original harness test files, with eight still missing. Deployment remains held for user review.

### Conversation discovery runtime source port

Ported all seven original conversation-discovery-runtime tests. Fixtures now seed native PostgreSQL chat_bots, chat_conversations, chat_conversation_mains, chat_bot_sections and chat_bot_viewer_state. Assertions retain the original service behavior, using PostgreSQL boolean values for pinned state. Verified discovery, inspect and rename, pin, section lookup and rename, section removal, and one bulk call moving two conversations. The combined isolated database run passed 20 runtime files and 131 tests in 31.53 seconds, recorded in /private/tmp/tanchat-runtime-20-files.log. Strict runtime TypeScript checking also passed. Model responses remain scripted; this verifies actual harness tool execution and shared services, not model accuracy or live integrations. The source inventory now has 20 of 27 runtime test files present, with seven still missing. No deployment or publication occurred.

### Plugin reference runtime source port and full gate findings

All 12 original plugin-reference-runtime cases now pass against isolated PostgreSQL. The fixture uses the actual McpAccounts.ensureLegacy service to import saved connections before binding them. Revocation after context preparation is injected at the real awaited save boundary after a context observation is recorded, allowing the PostgreSQL update to finish before dispatch, without changing production timing or using a synchronous database adapter. Native policy updates, credential writes, plugin disable and account disable operations retain original assertions. Source inventory now contains 21 of 27 original runtime files.

Full pnpm test runs exposed test infrastructure issues: the megabyte transport assertion was too expensive as generic array deep equality, so exact native Buffer byte equality now verifies unchanged payloads; the focused 41-case transport suite passes. Core worker concurrency is capped at four to avoid competing with the parallel project gates. The latest full gate stopped on type-aware lint errors in older runtime ports, not a passing full gate. Replaced ES2024-only schedule test helpers with ordinary promise gates and inaccurate reference environment casts with concrete getByName implementations. Those three modified suites pass 27 tests. Strict runtime typechecking is in progress, and the full gate must be rerun after fixes. Deployment remains held.

### Validation orchestration and concrete fixture contracts

The fifth full gate run completed site unit tests with 507 passed and two skipped, and type-aware lint with 101 warnings and zero errors. The core chat suite still timed out at the original five-second threshold in the 64-record evidence copy test, with 2067 other tests passing. This is not a green full gate. The complete pnpm test orchestration now runs gates sequentially using run-s, while the core suite uses four workers. This bounds competing resources and prevents one failing gate from interrupting other checks. A sequential full run is active, log /private/tmp/tanchat-current-full-gate-sequential.log. Concrete fixture contracts now include KODY_ORIGIN, fail-fast file methods for unexpected storage calls, valid included-model credentials and complete synthetic OAuth token fields. No broad environment casts were added to silence errors. Deployment remains held.

### Workspace approval runtime source port

Ported the original conversation-workspace-review suite with all 11 cases passing against isolated PostgreSQL. The Stop race uses a spy on the actual awaited readExecutionAuthority service, replacing the obsolete D1 statement wrapper. The suite retains durable approval persistence and rollback checks, no-command guarantees after Stop, and real stream patch base verification after alarm rollback and retry. Original source test file inventory now contains 22 of 27 files. Log: /private/tmp/tanchat-workspace-review-runtime.log. Full sequential project gate is still running at the typecheck stage, so this new port also requires strict type verification after the current run. No deployment.

### Complete sequential project gate passed

The sequential pnpm test run exited zero. All root, script, core harness and runtime harness TypeScript checks passed. Type-aware lint reported 101 warnings and zero errors. Site tests passed 508 with two skipped. All 208 chat core files passed, 2068 tests total, including the 64-record retry evidence copy case that timed out under the parallel project gates. Desktop passed all 17 tests. Authoritative log: /private/tmp/tanchat-current-full-gate-sequential.log. The latest workspace review port was present before the runtime typecheck stage, and is covered by this strict gate.

Restarted the local review server only after confirming no process listened on port 3001. Vite reports ready at http://localhost:3001/chat; process session 61365 remains live. Browser navigation to the actual consolidated app and subsequent tab inspection timed out in CDP, so rendered UI and real OAuth remain unverified. A cancelled stream was logged after browser navigation timeout. No deployment or production publication occurred.

### Valid-token plugin fixture isolation

Combined runtime validation exposed a fixture coupling after synthetic OAuth tokens were made structurally valid: the unified SkillCatalog started refreshing the unrelated Kody skill directory through a real MCP handshake. No request was transmitted because the fixture fetch guard threw. The selected-plugin approval case now stubs only Kody skill listing, suggestions and guidance, while keeping real shared plugin authorization, durable approvals, restart and revocation checks. All 12 plugin tests pass with the original no-network assertion preserved. Log: /private/tmp/tanchat-plugin-reference-verified.log. A new combined 22-file run is active at /private/tmp/tanchat-runtime-22-files-verified.log, no combined pass is claimed yet. Temporary diagnostic tracing was removed.

The combined 22-file runtime check exited zero. All 154 tests passed, including native plugin approval and workspace authority races. Log: /private/tmp/tanchat-runtime-22-files-verified.log. The isolated PostgreSQL test server was stopped after completion. This remains scripted-model runtime evidence, not proof of live OAuth, deployed Cloudflare behavior or real model accuracy.

### Current Cloudflare bundle verified locally

The current pnpm build:cloudflare run exited zero, log /private/tmp/tanchat-cloudflare-build-current.log. Worker configuration binds STREAMS, WORKSPACE_SYNC and CONVERSATIONS to source-exported classes and configures TanChatWorkflow under WORKFLOW_RUNS. This verifies the local bundle, not remote binding creation.

Build warnings originate from octane/compiler re-exporting Vite and bundler modules that use Node builtins. Inspected the emitted compiler-BiV0P-EY.js client chunk: it exports compile and contains none of node:fs, node:path, createRequire, readFileSync or octane/compiler/vite. The build strips those unused compiler exports, so no source change or private deep import was introduced. Browser execution of that compiler remains unverified. Deployment remains held.

## Motion, touch, and desktop fidelity check

Compared the source directly after the report of missing motion. The mobile drawer, long press, mobile back, mobile viewport, panel motion, resizable sidebar, and UI motion helper files are byte-identical to Gum. Motion element and AnimatePresence counts match in ConversationView, BotWorkspace, ConversationWorkspace, ConversationSession, ConversationTurn, and Modal. Chat route imports the scoped stylesheet containing the original motion rules. This proves source presence and selected wiring, not rendered behavior.

Ported the original mobile gesture tests with import path changes only, all six pass. All 17 Electron tests pass, including native bridge isolation, connected folders, update lifecycle, and consolidated chat launch. Electron code is retained, no shipping or deployment performed.

Browser security policy rejected local page inspection. The reported live motion regression remains unverified and unresolved, source parity must not be treated as UI fidelity proof. A full rendered interaction audit remains required.

Additional original interface coverage is now ported: mobile viewport and composer focus handoff, ten tests pass. Viewport tests cover software keyboard resize, Safari pan, event coalescing, pinch zoom, desktop release, and cleanup. Focus tests preserve first-send focus without stealing focus after another user action. MobileRuntime mounts the real viewport observer from ChatShell. These are simulated DOM checks, not real-device gesture verification.

### Additional fidelity gates

Ported original workspace panel, transcript minimap, and conversation thread UI tests with import path changes only. All 31 pass, including hidden panel state preservation, stable resource identity, panel authorization failures, thread request retry identity, and long transcript navigation. Current core test TypeScript gate passes after annotating the original focus fixture return type and updating the popup test import to the current shared module name.

Three real PostgreSQL bulk section race tests now pass. Awaitable pre-commit callbacks allow the tests to revoke membership, delete the destination, or change the selected section before mutation. The mutation rechecks state and rejects without overwriting it. Revoked membership uses the shared backend privacy-preserving 404, changed destination or selection uses 409. This is separate coverage, the full original assistant-conversation-tools test file remains unported.

The combined current ported runtime suite passes: 23 files, 157 tests, 32.63 seconds. Evidence: /private/tmp/tanchat-runtime-current-fidelity.log. This uses real PostgreSQL and Conversation code with scripted external transports, it does not prove live provider accuracy, browser fidelity, or deployed Cloudflare behavior. The isolated test database was stopped after the process completed.

Current interface fidelity batch: seven files, 54 tests pass. Full type-aware lint: 103 warnings, zero errors. The race fixture now explicitly rejects unexpected conversation lifecycle calls rather than relying on a partially typed namespace. The mobile hook test fixture is named as a component to retain the Rules of Hooks check.

## Installable chat and offline fidelity

Found and fixed a consolidation gap: the chat install prompt inherited the TanStack homepage manifest. Added /chat/manifest.webmanifest with TanChat identity and /chat entry/scope, reusing the existing TanStack PNG icons. The shared root chooses exactly one manifest based on matched chat paths, leaving other TanStack routes on the site manifest.

Moved the chat worker to /tanchat-sw.js so its /chat registration scope includes the exact entry route without a Service-Worker-Allowed override. Fetch interception is limited to the exact /chat path or /chat/ descendants. The worker only caches the public offline page, never authenticated HTML, APIs, mutations, or external requests. Twelve ported/expanded offline tests pass, including PNG dimensions, exact entry, nested navigation, auth/API/site isolation and subresource isolation. Actual browser installation remains unverified. No deployment performed.

All five current TypeScript gates pass after the install/offline changes: root application, builder evaluation scripts, shared scripts, core harness tests, and conversation runtime tests. Full lint reports 103 warnings and zero errors. Evidence: /private/tmp/tanchat-pwa-all-types.log and /private/tmp/tanchat-pwa-lint-final.log.

## Draft, attachment, reference, and execution fidelity

Ported original composer attachment, message attachment, composer reference, and response copy tests. Updated stale fixture shapes to include current draft synchronization and sketch/input props, removed unused controller-only props from the view fixture, and replaced the old untyped Env cast with a concrete file binding that rejects unexpected file I/O. Assertions remain unchanged. These four files pass 58 tests.

Together with existing original draft reconciliation, draft HTTP boundary, browser execution owner, and execution HTTP ports, the batch passes 205 tests across eight files. Coverage includes attachment byte fingerprints on retry, trusted scoped metadata, reference source labels, draft conflict preservation, account isolation, and exact local execution/preview ownership. Evidence: /private/tmp/tanchat-composer-execution-fidelity.log. Type-aware lint passes with 105 warnings and zero errors. These checks do not prove real browser model execution or file delivery.

## Workflow host runtime port

Ported the complete original workflow-runtime.test.ts against the native PostgreSQL conversation fixture. Adaptations are UUID account identity, native chat_conversations/chat_memberships statements, imported Cloudflare storage type, and destination import paths. All three original cases pass: idle host authority and reservation persistence through reconstruction, cancelled authority without receipt loss, and exact child identity/membership rechecks. Runtime TypeScript gate passes. Original runtime inventory now has 23 of 27 source files present, four remain unported. The separate three-case bulk section race file is additional coverage and does not stand in for the original assistant-conversation-tools suite.

Combined conversation runtime verification including the new workflow port passes: 24 files, 160 tests, 44.48 seconds (/private/tmp/tanchat-runtime-with-workflows.log). Workflow core/service boundary batch passes 52 tests across ten files (/private/tmp/tanchat-workflow-core-current.log). Full lint passes with 105 warnings, zero errors. Isolated PostgreSQL stopped after verification. Live cloud workflow execution and rendered task completion remain unverified, deployment is held.

## Conversation management runtime port

Ported all 29 original assistant-conversation-tools tests against real PostgreSQL. Seeds and reads use native shared tables and UUID users, booleans stay booleans, and deleted_at uses a PostgreSQL timestamp. The SQLite trigger failure is replaced with a native PostgreSQL trigger and function, removed in finally. The exact synthetic error is asserted through Drizzle cause, and all rows must remain unchanged after failure. No D1 compatibility database was introduced.

Original post-batch concurrent writes now run at the actual awaited workspace publish boundary after the transaction and before verification reads. Assertions retain observed revision/name and exactly one write. Async pre-commit changes retain cancellation, membership, selection and destination checks, with shared privacy-preserving 404 for revoked membership. All 29 pass. Added explicit Promise<BotSection[]> to readBotSections so section discovery has an explicit service contract in the type-aware lint gate. Lint passes with 105 warnings and zero errors. Original runtime inventory now has 24 of 27 files present, three remain unported. Source presence remains separate from execution evidence.

Combined runtime suite with full conversation management passes: 25 files, 189 tests, 38.17 seconds. Evidence: /private/tmp/tanchat-runtime-with-conversation-management.log. Runtime TypeScript gate passes after the section return annotation. The isolated PostgreSQL process was stopped after test completion. No deployment or live browser verification is implied.

## Shared session execution and snapshot fidelity

Ported all ten original execution HTTP cases and all seventeen original project snapshot HTTP cases through the real shared AuthService, SessionService, user and capability repositories, PostgreSQL conversation ownership, and Conversation host. Added four cases for tampered cookies, expired sessions, revoked session versions, and removed capabilities. All 31 cases pass across two files (/private/tmp/tanchat-execution-snapshots-verified.log).

The isolated database fixture adds auth columns using the actual Drizzle column types. It does not reproduce all shared schema constraints or prove production migrations. Test sessions are signed through the real session service, no fabricated authenticated user is injected. Cloudflare runtime bindings and R2 transport remain controlled fixtures. Snapshot checks retain exact binary bytes, checksum verification, immutable publication, retry recovery, revocation races, and restore authorization. Shared privacy checks return 404 after revoked conversation access.

Original runtime source coverage now includes 26 of 27 files. retry-attempt-runtime.test.ts remains unported. This inventory is not a claim of rendered UI parity or live service verification.

Combined runtime verification passes 220 tests across 27 files in 40.23 seconds (/private/tmp/tanchat-runtime-native-http-combined.log). This includes extra native race coverage, 26 of the 27 original source files are present. Runtime TypeScript passes and full lint reports 106 warnings, zero errors. Isolated PostgreSQL stopped after verification.

## Retry attempt runtime port

Ported the complete original retry-attempt-runtime.test.ts. Native Drizzle reads use shared retry and copy tables, account IDs are UUIDs, and membership mutations use PostgreSQL. Race hooks run after the real getAuthorizedCopyOperation and readConversationLifecycle boundaries, preserving final authorization races without a D1 compatibility layer. All 25 original cases pass, including immutable review records, inert inherited action evidence, private reasoning exclusion, branch preparation, reset recovery, queued retries, duplicate submission identity, validation races, and inherited inventory changes through repeated forks and copies.

Evidence: /private/tmp/tanchat-retry-attempt-native-current.log. Runtime TypeScript passes and full lint reports 106 warnings, zero errors. Original private Conversation state inspection and fixture casts are retained from the source tests, this is not a claim that all fixture casts have been removed. The runtime inventory now contains all 27 original source files. Live browser motion, production model/MCP tasks, deployed workflows, and release verification remain incomplete. Deployment stays held.

The combined runtime suite passes 245 tests across 28 files in 43.17 seconds (/private/tmp/tanchat-runtime-all-original-files.log). The extra file is native bulk race coverage, the original inventory is 27 of 27. The existing PR workflow already runs test:chat-runtime against PostgreSQL 17 after the disposable baseline, migrations, and cascade checks. Its remote job has not run for this worktree. Isolated local PostgreSQL stopped after verification.

## Full gate and emitted asset check after fidelity ports

The sequential full test command passed all five TypeScript gates, lint (106 warnings, zero errors), and site unit checks (508 pass, two skipped). Its first harness run found a stale chat-offline-worker test referencing the removed public/chat/sw.js path and excluding /chat. Updated that test to the actual root worker and to assert both exact /chat and nested navigation, preserving auth/API/site exclusion checks. The corrected full harness batch passes 2,185 tests across 219 files. Electron passes all 17 tests. A follow-up core test TypeScript check and lint also pass.

Evidence: /private/tmp/tanchat-full-gate-after-runtime-fidelity.log (initial offline fixture failure retained), /private/tmp/tanchat-chat-full-current.log, /private/tmp/tanchat-desktop-current.log, /private/tmp/tanchat-offline-test-types.log, /private/tmp/tanchat-final-fidelity-lint.log. These constituent checks pass, the original sequential command was not rerun after the one test fixture correction.

The current Cloudflare build succeeds (/private/tmp/tanchat-cloudflare-build-after-fidelity.log). Inspecting emitted client assets confirms scoped chat motion token definitions, reduced-motion rules, sidebar width transitions, the root service worker, chat manifest, offline page, and every referenced manifest icon. Build output includes existing Octane browser externalization warnings, this does not prove browser compilation works. Emitted CSS presence does not resolve the reported live animation regression. No deployment, publication, or production activation occurred.

## Chat document isolation and entry navigation

The source audit found a native integration gap: private chat documents did not send the isolation headers required by the reused local SDK and WebContainer runtime. Added the existing webContainerHeaders to the /chat layout, preserving private no-store headers. Shared Google/GitHub login validation is unchanged, the previously approved per-attempt popup completion channel remains in place.

Document isolation cannot change during SPA navigation. Site account/menu links and standalone project return links now use reloadDocument when entering chat. All legacy Builder redirects do the same while preserving project IDs, public hashes, template selection, and chart/project hash destinations. Chat-internal navigation is unchanged. No automatic refresh loop or isolation bypass was added.

Four focused files pass eleven checks for actual route header callbacks, all seven legacy redirect destinations, and shared/integration popup completion (/private/tmp/tanchat-isolation-entry-verified.log). Application and core test TypeScript gates pass; lint reports 106 warnings, zero errors. The current Cloudflare build passes (/private/tmp/tanchat-isolation-cloudflare-build.log), and its shared router asset retains the chat header callback. These are source and build checks, actual crossOriginIsolated, SDK startup, and Google/GitHub popup completion remain unverified in a real browser. Deployment remains held.

Corrected the desktop provenance inventory to reference desktop/builder.config.mjs, the actual ES module packaging configuration. All 22 desktop inventory destinations exist. Historical Kody assets remain inactive package inputs, the active icon uses the existing TanStack logo.

## Canonical chat origin and gateway environment

The chat.tanstack.com alias handler now redirects safe navigation to tanstack.com/chat before shared auth or database work. It keeps only validated chat navigation options, strips OAuth and unknown parameters, prevents fragment inheritance, and rejects non-navigation methods. Signed-in /chat entry now carries validated options into the assistant. Existing signed-out login checks remain unchanged. DNS and deployment are still held, the live alias is not verified.

Conversation runtime environment now inherits ProviderEnv directly, including optional Cloudflare gateway settings. This is a type contract correction, not gateway provisioning or evidence of live cost reporting. Nineteen focused redirect and entry checks passed before the route input typing adjustment. Final checks are recorded in /private/tmp/tanchat-entry-final-types.log, /private/tmp/tanchat-entry-final-test-types.log, /private/tmp/tanchat-entry-final-tests.log and /private/tmp/tanchat-entry-final-lint.log. Browser motion and touch behavior remain unverified, the browser inspection tool rejected local URL access and no alternate access path was used.

## Follow-up motion wiring audit

Rechecked the current destination rather than relying on the inventory. useMobileDrawer, useLongPress, mobile-back, and ui/motion are byte-identical to the source. App invokes useMobileDrawer with the live sidebar ref and drawer state. BotWorkspace retains MotionConfig, AnimatePresence, and motion layout nodes. The chat layout registers its scoped stylesheet through its route head. The shared theme provider removes its transition suppression class after two animation frames, it is not a permanent motion disable switch. These checks do not identify the reported rendered regression.

The current local Cloudflare build passes after the entry search change (/private/tmp/tanchat-current-audit-build.log). Application and harness TypeScript checks pass, the nineteen entry and alias tests pass, and lint reports 106 warnings with zero errors. No release or deployment took place. Browser and device verification remain required.

## Desktop release tooling and clean-checkout portability

Found and ported two missing original scripts, desktop-release.mjs and desktop-publish.mjs. Release verification retains signature identity, notarization, Gatekeeper, blockmap, artifact hash, and feed validation. Publishing retains immutable artifact checks and advertises the feed only after download verification. TanStack commands now expose verification, finalization, and publication separately. Publishing requires explicit TANSTACK_UPDATE_URL and TANSTACK_RELEASE_BUCKET, uses the configured update path for R2 object prefixes, and no longer targets the personal download host or Kody release bucket. Both scripts pass node --check. No notarization, upload, or publication was run.

The shared package.json, pnpm workspace override, and lockfile still reference browser-sandbox packages under a machine-local temporary directory. Those are pre-existing sibling-owned changes, preserved here. A passing build on this machine does not prove clean checkout installation or CI portability. This remains a release blocker alongside real browser verification and the explicit deployment hold.

## Operational script inventory and copy benchmarks

Added docs/tanchat-script-port-inventory.json listing every original script and its current destination, or an explicit unresolved disposition. Historical research, live evaluations, diagnostics, and smoke scripts are not covered by the runtime test inventory. Their missing paths must not be interpreted as a complete operational port.

Ported the actual original local SQLite copy and protocol benchmarks under scripts/chat, changing imports to the destination chat code. The source benchmark fixture casts remain unchanged. Both commands pass. At 50,000 turns the indexed lookup completes 100 lookups in 0.143 ms, compared with 598.751 ms for the old query. At 10,000 turns an early fork through the first three turns takes 5.51 ms and transfers 2,673 bytes. A full duplicate of 20,000 messages takes 2,717.85 ms locally, with 10,000 pages and 626 export/import bursts. These are synthetic local measurements, not network, Durable Object alarm, browser, or provider performance. Evidence is /private/tmp/tanchat-copy-benchmark-current.log and /private/tmp/tanchat-protocol-benchmark-current.log. The protocol result highlights why live long-copy verification still matters.

## First desktop release support

The source publisher assumed an existing latest-mac.yml feed, which cannot hold for a fresh TanStack update location. The port now accepts only an HTTP 404 as an absent feed, validates the first version, and preserves strict increasing-version checks for existing feeds. Other HTTP failures and malformed existing feeds still fail. Immutable artifact, checksum, signing, and feed-publication ordering checks remain in place. Three local version regression cases pass in desktop/release-version.test.mjs. This does not verify actual storage hosting or publication, neither was performed.

## Pre-bootstrap theme restoration

Found a shared-site appearance leak: the chat startup script changed document palette variables before AppearanceSync captured its restoration snapshot. Added a pre-palette snapshot in the actual startup script and consume it once during layout setup, retaining the existing snapshot path for later client-only mounts. Cleanup restores the pre-chat variables, appearance attributes, and theme-color metadata. This fixes capture order without changing theme preferences or auth. The actual startup script regression check passes and application TypeScript passes. Real browser route exit and rendered motion remain unverified.

The follow-up appearance test invokes the actual AppearanceSync layout cleanup, verifies restoration of palette values, missing-property removal, appearance attributes and theme-color metadata, and verifies the startup snapshot is consumed once. Both startup and cleanup regression cases pass (/private/tmp/tanchat-appearance-cleanup-tests.log). Full project verification is running under /private/tmp/tanchat-consolidation-current-full-gate.log, its result remains pending until the command exits.

## Current combined local gate

The complete pnpm test command exited zero after the appearance, entry-navigation, release-version, and benchmark type fixes. All five TypeScript gates pass, lint has 106 warnings and zero errors, site tests pass 508 with two skipped, harness tests pass 2,208 across 224 files, and Electron tests pass 20. Evidence: /private/tmp/tanchat-consolidation-current-full-gate.log. This replaces earlier pending or constituent-only gate results. PostgreSQL runtime verification remains separate, the last verified batch is 245 tests. No deployment or publication occurred.

## Live execution integration gap found during sibling recheck

Read current sibling work and inspected actual source. The shared site browser-sandbox dependency manifest reports API version 6. Chat executionArtifact still identifies the preserved API version 5 candidate and its old hashes. Chat ExecutionOwnersProvider actually opens execution-browser-bridge.ts, rather than the shared example SDK session. That bridge explicitly rejects production and any origin other than http://127.0.0.1:3002, then loads the broker at http://127.0.0.1:4320/gum-broker.html. The installed shared SDK directory has no gum-broker.html at its root. This does not prove a separately hosted broker is absent, but there is no evidence that the native TanStack chat execution path is operational.

The sibling browser-runtime work remains active and its recent evidence includes a plain-HTML build-loading failure. No compatible release or portable package was established by this check. Do not relabel old artifact hashes as the newer SDK, relax the bridge boundary to make a test pass, or infer chat execution readiness from shared example builds. The actual bridge/runtime adaptation and real execution remain explicit consolidation requirements. Existing source safeguards and sibling-owned dependencies were preserved.

Inspected the installed API 6 HostedKernel declarations. It already supplies isolated-host file access, run/spawn, process cleanup, snapshots, preview inspection/click and close. Recorded the concrete operation mapping and preserved ownership requirements in docs/tanchat-execution-adaptation.md. This establishes a reuse path without writing another sandbox, but does not implement or verify the replacement bridge.

## Execution host boundary revalidation

The existing scripts/local-browser-sandbox.ts plugin is serve-only and explicitly a local consumer experiment. It requires a tested manifest hash and isolated fixture inputs; the currently linked SDK directory has no manifest.json. It is not a production isolated-host deployment. The shared example SDK uses WorkerKernel directly, while chat still uses the older broker. No existing ready host URL or verified compatible artifact was established. This runtime/host dependency has persisted through three consecutive goal turns. Together with rejected live browser access and the explicit deployment hold, it prevents completing and verifying the requested end state. No dependency override, origin relaxation, fake artifact identity, alternate browser access, or deployment workaround was introduced.

## User-reported layout and polish regression

The user reports missing or partial animations, gestures and reveals in the actual TanStack app. Existing static parity and fixture gates do not rebut that observation. Found the conversation header rendered outside ConversationWorkspace, making it span the chat and right panel. Moved it into the workspace conversation children so the right panel sits alongside the full chat column. The broader motion regression remains unresolved and must be investigated from rendered evidence, not marked verified by retained handlers.
