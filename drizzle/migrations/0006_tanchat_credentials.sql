CREATE TABLE "chat_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_credentials" ADD CONSTRAINT "chat_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;