CREATE TABLE "chat_composer_drafts" (
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"value" text NOT NULL,
	"revision" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chat_composer_drafts_user_id_scope_pk" PRIMARY KEY("user_id","scope"),
	CONSTRAINT "chat_draft_revision_safe" CHECK ("chat_composer_drafts"."revision">0 AND "chat_composer_drafts"."revision"<=9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "chat_composer_drafts" ADD CONSTRAINT "chat_composer_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;