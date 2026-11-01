/*
# Scheduler: pg_cron job for scheduler-tick

## Changes:
1. Installs pg_cron and pg_net extensions (both available, not yet installed)
2. Schedules a cron job to call the scheduler-tick Edge Function every minute
3. Uses the Supabase Vault secret 'cron_secret' for authentication

## Notes:
- pg_cron and pg_net are available in this Supabase instance
- supabase_vault is already installed
- The cron job sends an HTTP POST to the scheduler-tick Edge Function
  with an x-cron-secret header for authentication
- The PROJECT_REF placeholder is replaced with the actual project reference
- The 'cron_secret' must be stored in Supabase Vault AND set as CRON_SECRET
  in Edge Function environment variables
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the scheduler-tick to run every minute
SELECT cron.schedule(
  'scheduler-tick',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://aadwwelobcwjklyvkrbc.supabase.co/functions/v1/scheduler-tick',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
