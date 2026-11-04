CREATE TABLE "chat_access" (
 "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
 "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
 "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_invites" (
 "token_hash" text PRIMARY KEY,
 "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "expires_at" timestamptz NOT NULL,
 "redeemed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
 "redeemed_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "chat_invites_creator_idx" ON "chat_invites" ("created_by");
