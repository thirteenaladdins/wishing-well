-- Create sessions table to track anonymous user sessions and their purchased wishes
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  purchased_wishes INTEGER DEFAULT 0 NOT NULL,
  free_wish_used BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Function to get or create a session
CREATE OR REPLACE FUNCTION get_or_create_session(session_token_param TEXT)
RETURNS TABLE(
  session_id UUID,
  session_token TEXT,
  purchased_wishes INTEGER,
  free_wish_used BOOLEAN
) AS $$
DECLARE
  session_exists BOOLEAN;
BEGIN
  -- Check if session exists
  SELECT EXISTS(
    SELECT 1 FROM sessions WHERE session_token = session_token_param
  ) INTO session_exists;
  
  -- If session exists, return it
  IF session_exists THEN
    RETURN QUERY
    SELECT s.id, s.session_token, s.purchased_wishes, s.free_wish_used
    FROM sessions s
    WHERE s.session_token = session_token_param;
  ELSE
    -- Create new session and return it
    RETURN QUERY
    INSERT INTO sessions (session_token, purchased_wishes, free_wish_used)
    VALUES (session_token_param, 0, FALSE)
    RETURNING sessions.id, sessions.session_token, sessions.purchased_wishes, sessions.free_wish_used;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can make a wish
CREATE OR REPLACE FUNCTION can_make_wish(session_token_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  session_data RECORD;
BEGIN
  SELECT * INTO session_data FROM get_or_create_session(session_token_param);
  
  -- Can make wish if free wish not used OR has purchased wishes
  RETURN NOT session_data.free_wish_used OR session_data.purchased_wishes > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to consume a wish (either free or purchased)
CREATE OR REPLACE FUNCTION consume_wish(session_token_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  session_data RECORD;
  updated_rows INTEGER;
BEGIN
  -- Get current session data
  SELECT * INTO session_data FROM get_or_create_session(session_token_param);
  
  -- Check if can make wish
  IF NOT can_make_wish(session_token_param) THEN
    RETURN FALSE;
  END IF;
  
  -- Consume the wish
  IF NOT session_data.free_wish_used THEN
    -- Use free wish
    UPDATE sessions 
    SET free_wish_used = TRUE, updated_at = NOW()
    WHERE session_token = session_token_param;
  ELSE
    -- Use purchased wish
    UPDATE sessions 
    SET purchased_wishes = purchased_wishes - 1, updated_at = NOW()
    WHERE session_token = session_token_param AND purchased_wishes > 0;
  END IF;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to add purchased wishes to a session
CREATE OR REPLACE FUNCTION add_purchased_wishes(session_token_param TEXT, wishes_to_add INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  -- Ensure session exists first
  PERFORM get_or_create_session(session_token_param);
  
  -- Add wishes
  UPDATE sessions 
  SET purchased_wishes = purchased_wishes + wishes_to_add, updated_at = NOW()
  WHERE session_token = session_token_param;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;
