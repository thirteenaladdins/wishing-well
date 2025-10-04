-- Fix the make_wish function to work with the new schema
-- Run this in your Supabase SQL editor

-- Update the make_wish function to use the new 'text' column instead of 'content'
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

  INSERT INTO public.wishes (text, session_token, boost_count, boosts)
  VALUES (left(btrim(wish_content), 200), session_token_param, 0, 0)
  RETURNING * INTO new_wish;

  RETURN new_wish;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
