-- Comprehensive fix for make_wish RPC function
-- Run this in your Supabase SQL editor

-- First, let's check the current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'wishes' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if the function exists and its signature
SELECT routine_name, routine_type, data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'make_wish' 
AND routine_schema = 'public';

-- Drop the existing function completely
DROP FUNCTION IF EXISTS public.make_wish(TEXT, TEXT);

-- Create a simple, working make_wish function
CREATE OR REPLACE FUNCTION public.make_wish(session_token_param TEXT, wish_content TEXT)
RETURNS JSON AS $$
DECLARE
  new_wish_id UUID;
  new_wish_record RECORD;
BEGIN
  -- Validate inputs
  IF wish_content IS NULL OR btrim(wish_content) = '' THEN
    RAISE EXCEPTION 'Wish content must not be empty';
  END IF;

  -- Check if user can make a wish
  IF NOT public.consume_wish(session_token_param) THEN
    RAISE EXCEPTION 'No wishes available';
  END IF;

  -- Insert the new wish
  INSERT INTO public.wishes (
    text, 
    content,  -- Keep both for compatibility
    session_token, 
    boost_count, 
    boosts,
    is_public, 
    flagged
  )
  VALUES (
    left(btrim(wish_content), 200),
    left(btrim(wish_content), 200),  -- Also populate content for backward compatibility
    session_token_param, 
    0, 
    0,
    true, 
    false
  )
  RETURNING id INTO new_wish_id;

  -- Get the full record
  SELECT * INTO new_wish_record
  FROM public.wishes 
  WHERE id = new_wish_id;

  -- Return as JSON
  RETURN json_build_object(
    'id', new_wish_record.id,
    'text', new_wish_record.text,
    'content', new_wish_record.content,
    'boost_count', new_wish_record.boost_count,
    'boosts', new_wish_record.boosts,
    'session_token', new_wish_record.session_token,
    'created_at', new_wish_record.created_at,
    'updated_at', new_wish_record.updated_at,
    'is_public', new_wish_record.is_public,
    'flagged', new_wish_record.flagged
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.make_wish(TEXT, TEXT) TO anon, authenticated;

-- Test the function
SELECT public.make_wish('test_session_123', 'This is a test wish');
