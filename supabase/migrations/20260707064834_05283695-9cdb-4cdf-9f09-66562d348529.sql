CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous version of the job so it isn't scheduled twice.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingest-incidents-30min') THEN
    PERFORM cron.unschedule('ingest-incidents-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'ingest-incidents-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9f45c9cd-7455-4919-a1a0-3bc07acb0b54.lovable.app/api/public/hooks/ingest-incidents',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtb2lnYmZuenp6emVodWRyZmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTc4NzYsImV4cCI6MjA5NzE5Mzg3Nn0.XyW54Ze9nJ97wggeIr3xbsWNE-L4h4SOtbOX2vCe01s"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  );
  $$
);