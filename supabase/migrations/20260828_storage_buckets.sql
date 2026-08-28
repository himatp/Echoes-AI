-- ====================================================================
-- SUPABASE STORAGE BUCKET SETUP: meeting-audio
-- Ensures direct browser-to-Supabase Storage audio uploads work cleanly
-- ====================================================================

-- 1. Create meeting-audio bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio', 'meeting-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public/authenticated upload access to meeting-audio bucket
DROP POLICY IF EXISTS "Public storage upload policy for meeting-audio" ON storage.objects;
CREATE POLICY "Public storage upload policy for meeting-audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meeting-audio');

-- 3. Allow public read access to meeting-audio bucket
DROP POLICY IF EXISTS "Public storage read policy for meeting-audio" ON storage.objects;
CREATE POLICY "Public storage read policy for meeting-audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meeting-audio');
