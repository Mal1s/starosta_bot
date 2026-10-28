/*
# RLS: Enable on all tables, service-role only

All tables have RLS enabled with NO policies for anon/authenticated.
All data access goes through Edge Functions using the service_role key,
which bypasses RLS. This ensures the client never touches tables directly.
*/

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users','groups','memberships','subgroups','member_subgroups','roster',
    'bell_schedule','schedule_slots','schedule_overrides','schedule_versions',
    'schedule_drafts','schedule_imports','holidays','planned_attendance',
    'actual_attendance','absences','recurring_absences','day_state',
    'announcements','announcement_reads','deliveries','leadership_events',
    'transfer_requests','votes','audit_log','bug_reports','weekly_reports'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Grant service_role full access (it bypasses RLS, but grants are still needed)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users','groups','memberships','subgroups','member_subgroups','roster',
    'bell_schedule','schedule_slots','schedule_overrides','schedule_versions',
    'schedule_drafts','schedule_imports','holidays','planned_attendance',
    'actual_attendance','absences','recurring_absences','day_state',
    'announcements','announcement_reads','deliveries','leadership_events',
    'transfer_requests','votes','audit_log','bug_reports','weekly_reports'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT ALL ON TABLE %I TO service_role;', t);
  END LOOP;
END $$;
