-- Test the make_wish function
-- Run this in your Supabase SQL editor to verify the function works

-- First, let's check if the function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'make_wish' 
AND routine_schema = 'public';

-- Test the function with a sample call
-- (This will fail if you don't have wishes available, but it will show us the function signature)
SELECT public.make_wish('test_session_123', 'This is a test wish');
