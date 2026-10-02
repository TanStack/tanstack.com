CREATE TABLE "chat_kody_links" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"username" text NOT NULL,
	CONSTRAINT "chat_kody_links_subject_unique" UNIQUE("subject")
);
--> statement-breakpoint
ALTER TABLE "chat_kody_links" ADD CONSTRAINT "chat_kody_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;