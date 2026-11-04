CREATE TABLE "chat_conversation_mains" (
	"bot_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" text NOT NULL,
	CONSTRAINT "chat_conversation_mains_bot_id_user_id_pk" PRIMARY KEY("bot_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" DROP CONSTRAINT "chat_conversation_user_bot";--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversation_identity" UNIQUE("id","bot_id","user_id");
--> statement-breakpoint
ALTER TABLE "chat_conversation_mains" ADD CONSTRAINT "chat_conversation_mains_conversation_id_bot_id_user_id_chat_conversations_id_bot_id_user_id_fk" FOREIGN KEY ("conversation_id","bot_id","user_id") REFERENCES "public"."chat_conversations"("id","bot_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
