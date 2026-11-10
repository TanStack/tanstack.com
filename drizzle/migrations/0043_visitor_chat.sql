CREATE TABLE "visitor_chat_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"sender_id" uuid,
	"sender_role" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_image" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_session_id" uuid NOT NULL,
	"visitor_proof_hash" text NOT NULL,
	"company" jsonb,
	"next_sequence" integer DEFAULT 0 NOT NULL,
	"delivered_through" integer DEFAULT 0 NOT NULL,
	"read_through" integer DEFAULT 0 NOT NULL,
	"last_visitor_seen_at" timestamp with time zone,
	"muted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_chats_origin_session_id_unique" UNIQUE("origin_session_id")
);
--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "chat_proof_hash" text;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "visitor_chat_id" uuid;--> statement-breakpoint
ALTER TABLE "visitor_chat_messages" ADD CONSTRAINT "visitor_chat_messages_chat_id_visitor_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."visitor_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_chat_messages" ADD CONSTRAINT "visitor_chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "visitor_chat_messages_sequence_idx" ON "visitor_chat_messages" USING btree ("chat_id","sequence");--> statement-breakpoint
CREATE INDEX "visitor_chats_updated_at_idx" ON "visitor_chats" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_visitor_chat_id_visitor_chats_id_fk" FOREIGN KEY ("visitor_chat_id") REFERENCES "public"."visitor_chats"("id") ON DELETE set null ON UPDATE no action;