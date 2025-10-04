CREATE TABLE IF NOT EXISTS wishes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL CHECK (length(content) <= 200),
  boost_count INTEGER DEFAULT 0 NOT NULL,
  session_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wishes_boost_count ON wishes(boost_count DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_created_at ON wishes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_session_token ON wishes(session_token);

CREATE OR REPLACE FUNCTION boost_wish(wish_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE wishes 
  SET boost_count = boost_count + 1,
      updated_at = NOW()
  WHERE id = wish_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wishes_updated_at') THEN
    CREATE TRIGGER update_wishes_updated_at
      BEFORE UPDATE ON wishes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'wishes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE wishes;
  END IF;
END
$$;
