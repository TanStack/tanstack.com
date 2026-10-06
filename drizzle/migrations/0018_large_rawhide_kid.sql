CREATE TABLE "chat_mcp_account_commands" (
	"user_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_mcp_account_commands_user_id_command_id_pk" PRIMARY KEY("user_id","command_id")
);
--> statement-breakpoint
CREATE TABLE "chat_mcp_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"auth_mode" text NOT NULL,
	"enabled" boolean NOT NULL,
	"removed" boolean NOT NULL,
	"revision" bigint NOT NULL,
	"grant_id" uuid NOT NULL,
	"token_revision" bigint NOT NULL,
	"ciphertext" text,
	"status" text NOT NULL,
	"checked_at" bigint,
	"error" text,
	"refresh_claim" uuid,
	"refresh_until" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chat_mcp_auth_mode" CHECK ("chat_mcp_accounts"."auth_mode" IN ('none','token','oauth')),
	CONSTRAINT "chat_mcp_status" CHECK ("chat_mcp_accounts"."status" IN ('configured','checked','needs_auth','error')),
	CONSTRAINT "chat_mcp_revision" CHECK ("chat_mcp_accounts"."revision">0),
	CONSTRAINT "chat_mcp_token_revision" CHECK ("chat_mcp_accounts"."token_revision">=0)
);
--> statement-breakpoint
ALTER TABLE "chat_mcp_account_commands" ADD CONSTRAINT "chat_mcp_account_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mcp_accounts" ADD CONSTRAINT "chat_mcp_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_mcp_owner" ON "chat_mcp_accounts" USING btree ("user_id","removed","id");