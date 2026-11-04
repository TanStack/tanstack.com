CREATE TABLE "chat_kody_account_probe" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_fingerprint" text NOT NULL,
	"source_fingerprint" text DEFAULT '' NOT NULL,
	"checked_at" bigint NOT NULL,
	"revision" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_kody_account_probe" ADD CONSTRAINT "chat_kody_account_probe_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;