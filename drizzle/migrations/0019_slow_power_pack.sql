CREATE TABLE "chat_mcp_setup_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text NOT NULL,
	"summary" jsonb NOT NULL,
	"ciphertext" text NOT NULL,
	"state_hash" text,
	"browser_hash" text,
	"expires_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chat_mcp_setup_attempts_state_hash_unique" UNIQUE("state_hash"),
	CONSTRAINT "chat_mcp_setup_status" CHECK ("chat_mcp_setup_attempts"."status" IN ('review','starting','authorize','complete','failed'))
);
--> statement-breakpoint
ALTER TABLE "chat_mcp_setup_attempts" ADD CONSTRAINT "chat_mcp_setup_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mcp_setup_attempts" ADD CONSTRAINT "chat_mcp_setup_attempts_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_mcp_setup_owner" ON "chat_mcp_setup_attempts" USING btree ("user_id","workspace_id","created_at");