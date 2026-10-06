ALTER TABLE "chat_bot_drafts" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "chat_bot_drafts" ADD COLUMN "text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_bot_drafts" ADD COLUMN "started_at" bigint;--> statement-breakpoint
ALTER TABLE "chat_bot_drafts" ADD COLUMN "run_model" jsonb;--> statement-breakpoint
ALTER TABLE "chat_bot_drafts" ADD COLUMN "reference_inputs" jsonb DEFAULT '[]'::jsonb NOT NULL;