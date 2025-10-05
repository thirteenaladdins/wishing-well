-- Fix boost_wish function parameter order to match what the database expects
-- The error message suggests the database is looking for boost_wish(session_token_param, wish_id)

-- Drop the existing function
DROP FUNCTION IF EXISTS public.boost_wish(UUID, TEXT);

-- Create the function with the correct parameter order
CREATE OR REPLACE FUNCTION public.boost_wish(session_token_param TEXT, wish_id UUID)
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

  -- Update both boost_count (for compatibility) and boosts (for new system)
  UPDATE public.wishes
  SET boost_count = boost_count + 1,
      boosts = boosts + 1,
      updated_at = NOW()
  WHERE id = wish_id;

  -- Also insert into wishes_boosts for analytics
  INSERT INTO public.wishes_boosts (wish_id, who) 
  VALUES (wish_id, session_token_param);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.boost_wish(TEXT, UUID) TO anon, authenticated;
