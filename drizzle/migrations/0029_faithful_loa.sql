CREATE TABLE "chat_kody_account_reference_catalog" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_fingerprint" text NOT NULL,
	"metadata" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	"revision" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_kody_account_reference_catalog" ADD CONSTRAINT "chat_kody_account_reference_catalog_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;