-- ====================================================================
-- MIGRATION: Add status and audio_url columns to meetings table
-- Supports Stage 1 (uploaded), Stage 2 (draft), and Stage 3 (completed) persistence
-- ====================================================================

ALTER TABLE public.meetings 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('uploaded', 'draft', 'completed')),
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Backfill any existing rows with NULL status to 'completed'
UPDATE public.meetings SET status = 'completed' WHERE status IS NULL;
