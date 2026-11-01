/*
# Database Functions: Delivery Queue Helpers

## Changes:
1. Creates `claim_deliveries(p_limit int)` — atomically claims queued deliveries
   for the worker. Uses `FOR UPDATE SKIP LOCKED` for safe concurrent claiming.
   Sets status to 'sending' and increments attempts.
2. Creates `requeue_stuck_deliveries()` — returns stuck 'sending' deliveries
   (older than 10 minutes, not sent, < 3 attempts) back to 'queued' status.

## Security:
- Functions are SECURITY INVOKER (callable by service_role through Edge Functions)
- No EXECUTE granted to anon/authenticated (only service_role uses them)
*/

-- Safe delivery claiming for the worker
CREATE OR REPLACE FUNCTION claim_deliveries(p_limit int)
RETURNS SETOF deliveries
LANGUAGE sql
AS $$
  UPDATE deliveries d
     SET status = 'sending', attempts = attempts + 1
   WHERE d.id IN (
     SELECT id FROM deliveries
      WHERE status = 'queued' AND send_at <= now()
      ORDER BY send_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED)
  RETURNING d.*;
$$;

-- Requeue stuck deliveries back to queued
CREATE OR REPLACE FUNCTION requeue_stuck_deliveries()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE deliveries SET status = 'queued'
   WHERE status = 'sending' AND created_at < now() - interval '10 minutes'
     AND sent_at IS NULL AND attempts < 3;
$$;
