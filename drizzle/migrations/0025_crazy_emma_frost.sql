CREATE TABLE "chat_connected_devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"grants" text DEFAULT '[]' NOT NULL,
	"last_seen" bigint DEFAULT 0 NOT NULL,
	"revoked_at" bigint,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_connected_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "chat_device_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" text NOT NULL,
	"request" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_connected_devices" ADD CONSTRAINT "chat_connected_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_device_operations" ADD CONSTRAINT "chat_device_operations_device_id_chat_connected_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."chat_connected_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_device_operations" ADD CONSTRAINT "chat_device_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_device_operations" ADD CONSTRAINT "chat_device_operations_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_devices_owner" ON "chat_connected_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_device_operations_pending" ON "chat_device_operations" USING btree ("device_id","status","expires_at");