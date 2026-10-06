CREATE TABLE "chat_mcp_reference_catalog" (
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"server_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"metadata" text NOT NULL,
	"fetched_at" bigint NOT NULL,
	"refresh_started_at" bigint NOT NULL,
	CONSTRAINT "chat_mcp_reference_catalog_workspace_id_user_id_server_id_pk" PRIMARY KEY("workspace_id","user_id","server_id")
);
--> statement-breakpoint
ALTER TABLE "chat_mcp_reference_catalog" ADD CONSTRAINT "chat_mcp_reference_catalog_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mcp_reference_catalog" ADD CONSTRAINT "chat_mcp_reference_catalog_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;