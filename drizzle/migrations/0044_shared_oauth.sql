ALTER TABLE "oauth_mcp_access_tokens" ALTER COLUMN "client_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "oauth_mcp_authorization_codes" ALTER COLUMN "client_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "oauth_mcp_refresh_tokens" ALTER COLUMN "client_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "oauth_mcp_access_tokens" ADD COLUMN "resource" text;--> statement-breakpoint
ALTER TABLE "oauth_mcp_access_tokens" ADD COLUMN "grant_id" uuid;--> statement-breakpoint
ALTER TABLE "oauth_mcp_authorization_codes" ADD COLUMN "resource" text;--> statement-breakpoint
ALTER TABLE "oauth_mcp_refresh_tokens" ADD COLUMN "resource" text;--> statement-breakpoint
ALTER TABLE "oauth_mcp_refresh_tokens" ADD COLUMN "scope" text DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_mcp_refresh_tokens" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "oauth_mcp_refresh_tokens" ADD COLUMN "grant_id" uuid;--> statement-breakpoint
CREATE INDEX "oauth_access_grant_idx" ON "oauth_mcp_access_tokens" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_grant_idx" ON "oauth_mcp_refresh_tokens" USING btree ("grant_id");