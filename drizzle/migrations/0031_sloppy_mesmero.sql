CREATE TABLE "chat_kody_reference_catalog" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_fingerprint" text NOT NULL,
	"metadata" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"data_revision" bigint DEFAULT 0 NOT NULL,
	"refresh_started_at" bigint NOT NULL,
	"revision" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_kody_reference_items" (
	"user_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"ordinal" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "chat_kody_reference_items_user_id_revision_ordinal_pk" PRIMARY KEY("user_id","revision","ordinal")
);
--> statement-breakpoint
ALTER TABLE "chat_kody_reference_catalog" ADD CONSTRAINT "chat_kody_reference_catalog_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_kody_reference_items" ADD CONSTRAINT "chat_kody_reference_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;