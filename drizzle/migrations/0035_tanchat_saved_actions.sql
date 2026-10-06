CREATE TABLE "chat_recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"code" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_recipes" ADD CONSTRAINT "chat_recipes_workspace_id_chat_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."chat_workspaces"("id") ON DELETE no action ON UPDATE no action;