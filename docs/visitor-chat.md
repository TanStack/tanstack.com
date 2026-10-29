# Visitor chat

Visitor chat is enabled in production with `VISITOR_CHAT_ENABLED=true`.
Set it to `false` to stop chat requests and invitations.

Admins open a company, choose a browser session, and send the first message.
That message opens a small visitor chat using the sender's display name and
profile image. Existing conversations open their transcript directly. Every
admin with access to the live dashboard shares the same inbox and can reply in
the same thread. Senders are assigned from the authenticated server session,
never from browser-provided names or account IDs. No access is granted to new
users by this feature.

## Loading and delivery

The existing 20-second presence request carries the invitation signal. Its
response stays empty until a conversation has a committed first message.
Only then does the browser import the visitor chat module and stylesheet.
Chat-specific utilities are excluded from the initial site stylesheet and built
into deferred stylesheets for the visitor window and admin inbox. The shared admin
inbox is also a separate lazy module, opened by Chats or a session's chat action.
The bridge adds no always-open chat connection or additional idle polling loop.
A non-secret browser hint restores an existing chat on reload, including when
presence tracking is off or the visitor is on a private route. The API still
requires the private signed cookie, and the hint never grants access to messages.
The root page contains only shared feature flags, so public HTML caching cannot
cause chat resources to load for another visitor. This does not collect private
page paths. Visitors with a page loaded
before this release must reload before chat becomes
available, and the admin action explains that state.

Invitations can take up to 20 seconds to appear. Once loaded, visitor and admin
messages poll every two seconds. The browser acknowledges the messages it
actually received, and only marks them seen while the chat is expanded in a
visible tab. These are browser signals, not proof of attention. The admin's
Chats badge and inbox show conversations whose latest message needs a reply.
Chat updates continue independently of pausing the live-company grid.

Conversation row locks order simultaneous sends. Client message IDs make retries
idempotent. History loads in pages of 100, and older pages remain available.
Messages are plain text. Enter sends and Shift+Enter inserts a line break.
There are no attachments, email delivery, push notifications, or typing indicators
in this version. Leaving the site does not turn a message into an email.

## Identity and retention

A random private proof accompanies the existing anonymous presence session. The
server stores its hash. The proof is never returned in admin responses. It binds
the initial invitation to the intended browser, rather than treating a visible
session ID as permission to read messages.

Once invited, the visitor receives a signed, HttpOnly, Secure, SameSite cookie.
It has a separate signing purpose from account cookies and lasts one year.
Reloads, tabs, and later presence sessions can resume the same conversation.
Clearing cookies, changing browsers, expiration, or signing-key rotation can
remove the visitor's connection to retained history. No IP, fingerprint, or
logged-in visitor account is used to recover it. Conversations target individual
browser sessions, not everyone at the matched company.

Chat history remains until an admin manually deletes it. Closing a conversation
keeps its history and permits reopening. Stop chat hides the visitor interface,
mutes the conversation, and sets a browser opt-out cookie. Admins cannot reopen
a visitor-muted conversation. Minimizing the window persists across reloads and
does not mark new messages seen. The latest unread messages are counted in its
collapsed header.

The chat tables do not depend on the 24-hour lifetime of presence records.
Sender names and avatar snapshots stay with their messages if an admin account
changes or is deleted. The company snapshot describes the network at initiation,
not a verified employer, and is shown only to admins. Manual deletion cascades
to all messages and clears presence references.

## Boundaries

All admin reads and writes check the current admin capability. Visitor APIs use
the signed chat cookie, not a supplied chat ID, and reject cross-site writes.
The new Cloudflare `VISITOR_CHAT_RATE_LIMITER` binding bounds requests per IP
without storing IPs in the application database. Missing or unavailable limits
fail closed. Message size and request body size are bounded.

Chat regions are excluded from clipboard analytics, including selections that
span a chat region. Message bodies, cookies, visitor details, and database
parameters are removed from Sentry events and transactions for these endpoints.
Driver write errors are replaced with a message that contains no SQL parameters.
The chat interface does not send message content to Scarf or GA.

## Release

1. Apply migration `0043_visitor_chat` through the normal migration flow.
2. Deploy the site Worker with the `VISITOR_CHAT_RATE_LIMITER` binding. The existing
   `SESSION_SECRET` signs the separately scoped visitor credential.
3. Verify invitation loading, two different admins in one thread, reload recovery,
   manual closure/deletion, visitor opt-out, and cold-page chunk loading.
4. Enable `VISITOR_CHAT_ENABLED=true` when ready to invite production visitors.

Local integration tests require a disposable, migrated `tanchat_test` PostgreSQL
database, and refuse a production database URL. The preview used synthetic users
and conversations and did not contact real site visitors.

## Test your own chat

Click **Test chat** in the live dashboard. It opens the public site in a new tab
with a test message from your admin profile, and opens the matching admin tab
labeled **Test chat · You**. Reply in either tab to test both sides. The visitor
tab uses the same window, history, reload recovery, and opt-out as a real chat.
Allow pop-ups for tanstack.com if the browser blocks the new tab.

This action requires admin access. It creates a separate conversation labeled
Test chat, without waiting for Scarf or adding a synthetic presence session.
The signed visitor cookie connects only your own browser to that conversation.
Each test creates a new conversation and makes it this browser's visitor chat.
Delete the test from the admin tab when finished. Other visitors are unaffected.
