-- Reinforce security for wishes and session management

-- Enable RLS on core tables (idempotent)
ALTER TABLE IF EXISTS public.wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to wishes for display purposes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wishes'
      AND policyname = 'Allow public read wishes'
  ) THEN
    CREATE POLICY "Allow public read wishes" ON public.wishes
      FOR SELECT
      USING (true);
  END IF;
END
$$;

-- Prevent anonymous direct writes to wishes (no policy means blocked under RLS)

-- Recreate helper functions with SECURITY DEFINER so they can operate under RLS

-- get_or_create_session: ensure session row exists and return details
CREATE OR REPLACE FUNCTION public.get_or_create_session(session_token_param TEXT)
RETURNS TABLE(
  session_id UUID,
  session_token TEXT,
  purchased_wishes INTEGER,
  free_wish_used BOOLEAN
) AS $$
DECLARE
  v_id UUID;
  v_token TEXT;
  v_purchased INTEGER;
  v_free BOOLEAN;
BEGIN
  SELECT s.id, s.session_token, s.purchased_wishes, s.free_wish_used
    INTO v_id, v_token, v_purchased, v_free
  FROM public.sessions s
  WHERE s.session_token = session_token_param;

  IF NOT FOUND THEN
    INSERT INTO public.sessions (session_token, purchased_wishes, free_wish_used)
    VALUES (session_token_param, 0, FALSE)
    RETURNING id, session_token, purchased_wishes, free_wish_used
    INTO v_id, v_token, v_purchased, v_free;
  END IF;

  RETURN QUERY
  SELECT v_id, v_token, v_purchased, v_free;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- can_make_wish: derive availability solely on server data
CREATE OR REPLACE FUNCTION public.can_make_wish(session_token_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  session_row RECORD;
BEGIN
  SELECT * INTO session_row FROM public.get_or_create_session(session_token_param);
  RETURN NOT session_row.free_wish_used OR session_row.purchased_wishes > 0;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- consume_wish: spend a free or purchased wish atomically
CREATE OR REPLACE FUNCTION public.consume_wish(session_token_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  session_row RECORD;
  updated_rows INTEGER;
BEGIN
  SELECT * INTO session_row FROM public.get_or_create_session(session_token_param);

  IF session_row.free_wish_used = FALSE THEN
    UPDATE public.sessions
    SET free_wish_used = TRUE,
        updated_at = NOW()
    WHERE session_token = session_token_param;
  ELSIF session_row.purchased_wishes > 0 THEN
    UPDATE public.sessions
    SET purchased_wishes = purchased_wishes - 1,
        updated_at = NOW()
    WHERE session_token = session_token_param
      AND purchased_wishes > 0;
  ELSE
    RETURN FALSE;
  END IF;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- add_purchased_wishes: used by server-side integrations (webhooks)
CREATE OR REPLACE FUNCTION public.add_purchased_wishes(session_token_param TEXT, wishes_to_add INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  IF wishes_to_add IS NULL OR wishes_to_add <= 0 THEN
    RAISE EXCEPTION 'wishes_to_add must be positive';
  END IF;

  PERFORM public.get_or_create_session(session_token_param);

  UPDATE public.sessions
  SET purchased_wishes = purchased_wishes + wishes_to_add,
      updated_at = NOW()
  WHERE session_token = session_token_param;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Helper to insert new wish while enforcing quotas
CREATE OR REPLACE FUNCTION public.make_wish(session_token_param TEXT, wish_content TEXT)
RETURNS public.wishes AS $$
DECLARE
  new_wish public.wishes%ROWTYPE;
BEGIN
  IF wish_content IS NULL OR btrim(wish_content) = '' THEN
    RAISE EXCEPTION 'Wish content must not be empty';
  END IF;

  IF NOT public.consume_wish(session_token_param) THEN
    RAISE EXCEPTION 'No wishes available';
  END IF;

  INSERT INTO public.wishes (content, session_token, boost_count)
  VALUES (left(btrim(wish_content), 200), session_token_param, 0)
  RETURNING * INTO new_wish;

  RETURN new_wish;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Replace boost_wish to enforce quota checks and session tracking
DROP FUNCTION IF EXISTS public.boost_wish(UUID);

CREATE OR REPLACE FUNCTION public.boost_wish(wish_id UUID, session_token_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  target_wish public.wishes%ROWTYPE;
BEGIN
  SELECT * INTO target_wish FROM public.wishes WHERE id = wish_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wish not found';
  END IF;

  IF NOT public.consume_wish(session_token_param) THEN
    RAISE EXCEPTION 'No wishes available';
  END IF;

  UPDATE public.wishes
  SET boost_count = boost_count + 1,
      updated_at = NOW()
  WHERE id = wish_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Restrict execute permissions for helper functions
REVOKE ALL ON FUNCTION public.add_purchased_wishes(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_wish(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_purchased_wishes(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_wish(TEXT) TO service_role;

-- Allow clients to execute the safe RPC entry points
GRANT EXECUTE ON FUNCTION public.get_or_create_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_make_wish(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.make_wish(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boost_wish(UUID, TEXT) TO anon, authenticated;
