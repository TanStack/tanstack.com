-- Run the existing allowance protocol next to its data, in one network call.
-- VOLATILE gives each query a fresh snapshot after the advisory locks resolve.
CREATE FUNCTION public.reserve_chat_run_usage(request jsonb, receipt_lock_key text)
RETURNS TABLE(outcome text, receipt_day text)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  conversation_id_value text := request->>'conversationId';
  run_id_value text := request->>'runId';
  workspace_id_value text := request->>'workspaceId';
  user_id_value uuid := (request->>'userId')::uuid;
  bot_id_value text := request->>'botId';
  scheduled_value boolean := (request->>'scheduled')::boolean;
  day_value text := request->>'day';
  unlimited_value boolean := (request->>'unlimited')::boolean;
  spend jsonb := request->'spend';
  reservation bigint := (spend->>'reservationMicros')::bigint;
  receipt chat_run_usage_receipts%ROWTYPE;
  user_turns bigint;
  global_turns bigint;
  scheduled_turns bigint;
  user_spend bigint;
  global_spend bigint;
  included_admin boolean := false;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(receipt_lock_key, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('chat-run-usage:' || day_value, 0));
  SELECT * INTO receipt FROM chat_run_usage_receipts
    WHERE conversation_id=conversation_id_value AND run_id=run_id_value;
  IF FOUND THEN
    IF receipt.workspace_id <> workspace_id_value OR receipt.user_id <> user_id_value
      OR receipt.bot_id <> bot_id_value OR receipt.scheduled <> scheduled_value THEN
      RETURN QUERY SELECT 'conflict'::text, receipt.day;
    ELSE
      RETURN QUERY SELECT 'duplicate'::text, receipt.day;
    END IF;
    RETURN;
  END IF;
  SELECT
    COALESCE((SELECT turns FROM chat_daily_usage WHERE user_id=user_id_value::text AND day=day_value),0),
    COALESCE((SELECT turns FROM chat_daily_usage WHERE user_id='__global' AND day=day_value),0),
    COALESCE((SELECT turns FROM chat_scheduled_daily_usage WHERE user_id=user_id_value AND day=day_value),0),
    COALESCE((SELECT SUM(billed_micros) FROM chat_funded_spend WHERE user_id=user_id_value AND day=day_value),0),
    COALESCE((SELECT SUM(billed_micros) FROM chat_funded_spend WHERE day=day_value),0)
    INTO user_turns,global_turns,scheduled_turns,user_spend,global_spend;
  IF NOT (request->>'lift')::boolean AND user_turns >= (request->>'dailyLimit')::integer THEN
    RETURN QUERY SELECT 'user'::text, day_value; RETURN;
  END IF;
  IF NOT (request->>'lift')::boolean AND global_turns >= 300 THEN
    RETURN QUERY SELECT 'global'::text, day_value; RETURN;
  END IF;
  IF NOT unlimited_value AND scheduled_value AND scheduled_turns >= (request->>'scheduledLimit')::integer THEN
    RETURN QUERY SELECT 'scheduled'::text, day_value; RETURN;
  END IF;
  IF reservation IS NOT NULL AND NOT unlimited_value THEN
    SELECT EXISTS (
      SELECT 1 FROM users u
      LEFT JOIN role_assignments a ON a.user_id=u.id
      LEFT JOIN roles r ON r.id=a.role_id
      WHERE u.id=user_id_value AND
        ('admin'=ANY(u.capabilities::text::text[]) OR 'admin'=ANY(r.capabilities::text::text[]))
    ) INTO included_admin;
    IF NOT included_admin AND user_spend + reservation > (spend->>'userCapMicros')::bigint THEN
      RETURN QUERY SELECT 'user-spend'::text, day_value; RETURN;
    END IF;
    IF NOT included_admin AND global_spend + reservation > (spend->>'globalCapMicros')::bigint THEN
      RETURN QUERY SELECT 'global-spend'::text, day_value; RETURN;
    END IF;
  END IF;
  INSERT INTO chat_run_usage_receipts(conversation_id,run_id,workspace_id,user_id,bot_id,scheduled,day,created_at,attempt_id)
    VALUES(conversation_id_value,run_id_value,workspace_id_value,user_id_value,bot_id_value,scheduled_value,day_value,
      (request->>'now')::bigint,(request->>'attemptId')::uuid);
  INSERT INTO chat_daily_usage(user_id,day,turns)
    VALUES(user_id_value::text,day_value,1),('__global',day_value,1)
    ON CONFLICT(user_id,day) DO UPDATE SET turns=chat_daily_usage.turns+1;
  IF reservation IS NOT NULL THEN
    INSERT INTO chat_funded_spend(conversation_id,run_id,user_id,day,reserved_micros,billed_micros)
      VALUES(conversation_id_value,run_id_value,user_id_value,day_value,reservation,reservation);
  END IF;
  IF scheduled_value THEN
    INSERT INTO chat_scheduled_daily_usage(user_id,day,turns) VALUES(user_id_value,day_value,1)
      ON CONFLICT(user_id,day) DO UPDATE SET turns=chat_scheduled_daily_usage.turns+1;
  END IF;
  RETURN QUERY SELECT 'reserved'::text, day_value;
END;
$$;
