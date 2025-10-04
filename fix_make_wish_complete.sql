-- Complete fix for make_wish function
-- Run this in your Supabase SQL editor

-- First, let's check what columns exist in the wishes table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'wishes' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Drop and recreate the make_wish function with proper column references
DROP FUNCTION IF EXISTS public.make_wish(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.make_wish(session_token_param TEXT, wish_content TEXT)
RETURNS TABLE(
  id UUID,
  text TEXT,
  content TEXT,
  boost_count INTEGER,
  boosts INTEGER,
  session_token TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_public BOOLEAN,
  flagged BOOLEAN
) AS $$
DECLARE
  new_wish RECORD;
BEGIN
  IF wish_content IS NULL OR btrim(wish_content) = '' THEN
    RAISE EXCEPTION 'Wish content must not be empty';
  END IF;

  IF NOT public.consume_wish(session_token_param) THEN
    RAISE EXCEPTION 'No wishes available';
  END IF;

  INSERT INTO public.wishes (text, session_token, boost_count, boosts, is_public, flagged)
  VALUES (
    left(btrim(wish_content), 200), 
    session_token_param, 
    0, 
    0, 
    true, 
    false
  )
  RETURNING 
    id,
    text,
    content,
    boost_count,
    boosts,
    session_token,
    created_at,
    updated_at,
    is_public,
    flagged
  INTO new_wish;

  RETURN QUERY SELECT 
    new_wish.id,
    new_wish.text,
    new_wish.content,
    new_wish.boost_count,
    new_wish.boosts,
    new_wish.session_token,
    new_wish.created_at,
    new_wish.updated_at,
    new_wish.is_public,
    new_wish.flagged;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.make_wish(TEXT, TEXT) TO anon, authenticated;
