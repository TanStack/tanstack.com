CREATE TABLE chat_account_onboarding (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped')),
 use_case text CHECK (use_case IS NULL OR use_case IN ('everyday','work','building')),
 completed_at bigint CHECK (completed_at IS NULL OR completed_at BETWEEN 0 AND 9007199254740991),
 CHECK (status != 'pending' OR completed_at IS NULL),
 CHECK (status != 'completed' OR completed_at IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE chat_account_onboarding_commands (
 user_id uuid NOT NULL REFERENCES chat_account_onboarding(user_id) ON DELETE CASCADE,
 command_id uuid NOT NULL, request_digest text NOT NULL, mutation_id uuid NOT NULL,
 result_json text NOT NULL CHECK (jsonb_typeof(result_json::jsonb)='object'),
 PRIMARY KEY(user_id,command_id)
);
