CREATE TABLE "chat_account_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text,
	"revision" bigint DEFAULT 0 NOT NULL,
	"timezone_confirmed_at" bigint,
	"response" jsonb,
	"appearance" jsonb,
	CONSTRAINT "chat_preferences_revision_safe" CHECK ("chat_account_preferences"."revision" >= 0 AND "chat_account_preferences"."revision" <= 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "chat_account_preferences" ADD CONSTRAINT "chat_account_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;