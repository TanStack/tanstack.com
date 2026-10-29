CREATE TABLE "live_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company" jsonb,
	"lookup_status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_tabs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"page" text NOT NULL,
	"visible" boolean NOT NULL,
	"sequence" bigint NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"activity" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_tabs" ADD CONSTRAINT "live_tabs_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_sessions_created_at_idx" ON "live_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "live_tabs_last_seen_idx" ON "live_tabs" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "live_tabs_session_idx" ON "live_tabs" USING btree ("session_id");