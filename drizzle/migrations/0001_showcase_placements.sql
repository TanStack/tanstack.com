CREATE TYPE "public"."showcase_placement" AS ENUM('showcase', 'community', 'private');--> statement-breakpoint
ALTER TABLE "showcases" ADD COLUMN "placement" "showcase_placement";--> statement-breakpoint
-- Preserve existing visibility. Editorial decisions are applied separately.
UPDATE "showcases" SET "placement" = CASE WHEN "status" = 'approved' THEN 'showcase'::showcase_placement ELSE 'private'::showcase_placement END;--> statement-breakpoint
ALTER TABLE "showcases" ALTER COLUMN "placement" SET DEFAULT 'private';--> statement-breakpoint
ALTER TABLE "showcases" ALTER COLUMN "placement" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "showcases" ADD COLUMN "review_reason" text;--> statement-breakpoint
CREATE INDEX "showcases_status_placement_idx" ON "showcases" USING btree ("status","placement");