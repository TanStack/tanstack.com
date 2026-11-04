CREATE TABLE "chat_daily_usage" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"turns" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_daily_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "chat_funded_spend" (
	"conversation_id" text NOT NULL,
	"run_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	"reserved_micros" bigint NOT NULL,
	"billed_micros" bigint NOT NULL,
	"observed_micros" bigint DEFAULT 0 NOT NULL,
	"unknown" boolean DEFAULT false NOT NULL,
	CONSTRAINT "chat_funded_spend_conversation_id_run_id_pk" PRIMARY KEY("conversation_id","run_id")
);
--> statement-breakpoint
CREATE TABLE "chat_run_usage_receipts" (
	"conversation_id" text NOT NULL,
	"run_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"bot_id" text NOT NULL,
	"scheduled" boolean NOT NULL,
	"day" text NOT NULL,
	"created_at" bigint NOT NULL,
	"attempt_id" uuid NOT NULL,
	CONSTRAINT "chat_run_usage_receipts_conversation_id_run_id_pk" PRIMARY KEY("conversation_id","run_id"),
	CONSTRAINT "chat_run_usage_receipts_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "chat_scheduled_daily_usage" (
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	"turns" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_scheduled_daily_usage_user_id_day_pk" PRIMARY KEY("user_id","day"),
	CONSTRAINT "chat_scheduled_turns_nonnegative" CHECK ("chat_scheduled_daily_usage"."turns">=0)
);
--> statement-breakpoint
ALTER TABLE "chat_funded_spend" ADD CONSTRAINT "chat_funded_spend_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_funded_spend" ADD CONSTRAINT "chat_funded_spend_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_run_usage_receipts" ADD CONSTRAINT "chat_run_usage_receipts_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_run_usage_receipts" ADD CONSTRAINT "chat_run_usage_receipts_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_run_usage_receipts" ADD CONSTRAINT "chat_run_usage_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_run_usage_receipts" ADD CONSTRAINT "chat_run_usage_receipts_bot_id_chat_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."chat_bots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_scheduled_daily_usage" ADD CONSTRAINT "chat_scheduled_daily_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_funded_spend_day_user" ON "chat_funded_spend" USING btree ("day","user_id");