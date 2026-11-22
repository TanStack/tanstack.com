CREATE TABLE "chat_kody_oauth_clients" (
 "origin" text PRIMARY KEY NOT NULL,
 "client_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_kody_oauth_pending" (
 "state_hash" text PRIMARY KEY NOT NULL,
 "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "payload" text NOT NULL,
 "expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chat_kody_oauth_pending_expiry" ON "chat_kody_oauth_pending" ("expires_at");
