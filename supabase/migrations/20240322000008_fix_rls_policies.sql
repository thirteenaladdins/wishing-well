-- Fix RLS policies for anonymous users

-- Enable RLS on sessions table
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read and write to sessions table
CREATE POLICY "Allow anonymous access to sessions" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anonymous users to read and write to wishes table
CREATE POLICY "Allow anonymous access to wishes" ON wishes
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anonymous users to read webhook_events (for debugging)
CREATE POLICY "Allow anonymous read access to webhook_events" ON webhook_events
  FOR SELECT USING (true);
