-- Track the news source of auto-ingested incidents to prevent duplicates
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS source_url text;

-- Unique index prevents inserting the same news article twice.
-- Multiple NULLs are allowed by Postgres, so user-submitted incidents are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS incidents_source_url_key ON public.incidents (source_url) WHERE source_url IS NOT NULL;