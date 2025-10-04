-- Setup feed tabs functionality
-- Run this in your Supabase SQL editor

-- Add new columns to existing wishes table
ALTER TABLE public.wishes 
ADD COLUMN IF NOT EXISTS text TEXT,
ADD COLUMN IF NOT EXISTS boosts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;

-- Migrate existing data
UPDATE public.wishes 
SET text = content, 
    boosts = boost_count,
    is_public = true,
    flagged = false
WHERE text IS NULL;

-- Make text column not null after migration
ALTER TABLE public.wishes ALTER COLUMN text SET NOT NULL;

-- Add check constraint for text length
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wishes_text_length_check'
  ) THEN
    ALTER TABLE public.wishes 
    ADD CONSTRAINT wishes_text_length_check CHECK (length(text) BETWEEN 1 AND 500);
  END IF;
END
$$;

-- Create wishes_boosts table
CREATE TABLE IF NOT EXISTS public.wishes_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id UUID NOT NULL REFERENCES public.wishes(id) ON DELETE CASCADE,
  who TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wishes_created ON public.wishes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_boosts ON public.wishes (boosts DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_boosts_wish_time ON public.wishes_boosts (wish_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_boosts_who ON public.wishes_boosts (who, created_at DESC);

-- Drop existing boost function if it exists
DROP FUNCTION IF EXISTS public.boost_wish(UUID, TEXT);

-- Create boost function
CREATE OR REPLACE FUNCTION public.boost_wish(p_wish_id UUID, p_who TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.wishes_boosts (wish_id, who) VALUES (p_wish_id, p_who);
  UPDATE public.wishes SET boosts = boosts + 1 WHERE id = p_wish_id;
END;
$$;

-- Create views
CREATE OR REPLACE VIEW public.wishes_hot AS
SELECT
  w.*,
  (w.boosts * exp(-ln(2) * extract(epoch from (now() - w.created_at)) / (48*3600)))::float as score
FROM public.wishes w
WHERE w.is_public = true AND w.flagged = false
ORDER BY score DESC, w.created_at DESC;

CREATE OR REPLACE VIEW public.wishes_top AS
SELECT w.*
FROM public.wishes w
WHERE w.is_public = true AND w.flagged = false
ORDER BY w.boosts DESC, w.created_at DESC;

CREATE OR REPLACE VIEW public.wishes_new AS
SELECT w.*
FROM public.wishes w
WHERE w.is_public = true AND w.flagged = false
ORDER BY w.created_at DESC;

CREATE OR REPLACE VIEW public.wishes_legends AS
SELECT * FROM public.wishes
WHERE boosts >= 100 AND is_public = true AND flagged = false
ORDER BY boosts DESC, created_at DESC;

CREATE OR REPLACE VIEW public.wishes_rising AS
SELECT 
  w.*,
  COALESCE(recent_boosts.count, 0) as recent_boosts_count
FROM public.wishes w
LEFT JOIN (
  SELECT 
    wish_id, 
    COUNT(*) as count
  FROM public.wishes_boosts 
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY wish_id
) recent_boosts ON w.id = recent_boosts.wish_id
WHERE w.is_public = true AND w.flagged = false
ORDER BY recent_boosts_count DESC, w.boosts DESC, w.created_at DESC;

-- Enable RLS on wishes_boosts
ALTER TABLE public.wishes_boosts ENABLE ROW LEVEL SECURITY;

-- Create policy for wishes_boosts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'wishes_boosts' 
      AND policyname = 'Allow public read wishes_boosts'
  ) THEN
    CREATE POLICY "Allow public read wishes_boosts" ON public.wishes_boosts
      FOR SELECT
      USING (true);
  END IF;
END
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.boost_wish(UUID, TEXT) TO anon, authenticated;

-- Add to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'wishes_boosts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wishes_boosts;
  END IF;
END
$$;
