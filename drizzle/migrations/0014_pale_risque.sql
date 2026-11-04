CREATE TABLE "chat_kody_refresh_claims" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"token_fingerprint" text NOT NULL,
	"claim_id" uuid NOT NULL,
	"status" text NOT NULL,
	"lease_until" bigint NOT NULL,
	CONSTRAINT "chat_kody_refresh_status" CHECK ("chat_kody_refresh_claims"."status" IN ('refreshing','completed','needs_auth'))
);
--> statement-breakpoint
ALTER TABLE "chat_kody_refresh_claims" ADD CONSTRAINT "chat_kody_refresh_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;