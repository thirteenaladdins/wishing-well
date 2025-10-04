-- Fix the get_or_create_session function to resolve ambiguous column references
-- Run this in your Supabase SQL editor

-- Drop and recreate the get_or_create_session function with explicit table references
DROP FUNCTION IF EXISTS public.get_or_create_session(TEXT);

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
    RETURNING sessions.id, sessions.session_token, sessions.purchased_wishes, sessions.free_wish_used
    INTO v_id, v_token, v_purchased, v_free;
  END IF;

  RETURN QUERY
  SELECT v_id, v_token, v_purchased, v_free;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_session(TEXT) TO anon, authenticated;
