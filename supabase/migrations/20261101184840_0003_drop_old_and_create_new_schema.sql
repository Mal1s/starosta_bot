/*
# Full Schema Rebuild per File 03 Spec

This migration drops the old incompatible tables (all empty, 0 rows) and recreates
the entire schema using proper Postgres ENUMs, correct column names, and all tables
from the product specification (file 03_DATABASE_BACKEND_API.md).

## Changes:
1. Drops all existing tables (cascade)
2. Creates 15 ENUM types for type-safe columns
3. Creates all tables per spec: users, groups, memberships, roster, subgroups,
   membership_subgroups, bell_schedule, schedule_slots, schedule_versions,
   schedule_drafts, schedule_imports, schedule_overrides, holidays,
   planned_attendance, absences, recurring_absences, actual_attendance,
   day_state, announcements, announcement_audience, announcement_reads,
   announcement_templates, deliveries, leadership_events, transfer_requests,
   votes, vote_candidates, vote_ballots, bug_reports, complaints, audit_log,
   rate_limits, gemini_usage, weekly_reports
4. Creates indexes for performance-critical queries
5. Enables RLS on all tables (service-role only access)
6. Grants ALL to service_role on all tables

## Security:
- RLS enabled on every table with NO policies for anon/authenticated
- All data access goes through Edge Functions using service_role key
- service_role bypasses RLS but still needs explicit GRANTs
*/

-- ========== Drop old tables (all empty, safe to drop) ==========
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE;', t);
  END LOOP;
END $$;

-- ========== Drop old enums if any exist ==========
DROP TYPE IF EXISTS member_role CASCADE;
DROP TYPE IF EXISTS member_status CASCADE;
DROP TYPE IF EXISTS join_mode CASCADE;
DROP TYPE IF EXISTS poll_mode CASCADE;
DROP TYPE IF EXISTS group_state CASCADE;
DROP TYPE IF EXISTS answer_kind CASCADE;
DROP TYPE IF EXISTS absence_reason CASCADE;
DROP TYPE IF EXISTS fact_status CASCADE;
DROP TYPE IF EXISTS lesson_kind CASCADE;
DROP TYPE IF EXISTS week_parity CASCADE;
DROP TYPE IF EXISTS override_action CASCADE;
DROP TYPE IF EXISTS delivery_status CASCADE;
DROP TYPE IF EXISTS vote_status CASCADE;
DROP TYPE IF EXISTS request_status CASCADE;
DROP TYPE IF EXISTS ticket_status CASCADE;

-- ========== Extensions ==========
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========== ENUM types ==========
CREATE TYPE member_role     AS ENUM ('student','deputy','headman');
CREATE TYPE member_status   AS ENUM ('pending','active','removed','left');
CREATE TYPE join_mode       AS ENUM ('approval','auto');
CREATE TYPE poll_mode       AS ENUM ('evening_morning','morning','evening');
CREATE TYPE group_state     AS ENUM ('active','no_headman','pending_deletion');
CREATE TYPE answer_kind     AS ENUM ('will','wont','late');
CREATE TYPE absence_reason  AS ENUM ('valid','dont_want','sick');
CREATE TYPE fact_status     AS ENUM ('present','absent','late','valid','sick');
CREATE TYPE lesson_kind     AS ENUM ('lecture','practice','lab','other');
CREATE TYPE week_parity     AS ENUM ('all','odd','even');
CREATE TYPE override_action AS ENUM ('cancel','move','replace');
CREATE TYPE delivery_status AS ENUM ('queued','sending','sent','failed','blocked','skipped');
CREATE TYPE vote_status     AS ENUM ('open','closed','no_quorum');
CREATE TYPE request_status  AS ENUM ('pending','accepted','cancelled','expired');
CREATE TYPE ticket_status   AS ENUM ('new','accepted','needs_info','fixed','duplicate');

-- ========== users ==========
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  first_name text, last_name text, username text,
  language_code text NOT NULL DEFAULT 'ru',
  timezone text,
  theme text NOT NULL DEFAULT 'dark',
  background text NOT NULL DEFAULT 'gradient',
  reduce_motion boolean NOT NULL DEFAULT false,
  lesson_reminder_minutes int DEFAULT 30,
  bot_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ========== groups ==========
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  institution text,
  course int,
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  state group_state NOT NULL DEFAULT 'active',
  delete_after timestamptz,
  invite_token_hash text UNIQUE,
  short_code text UNIQUE,
  recovery_hash text,
  join_mode join_mode NOT NULL DEFAULT 'approval',
  member_limit int NOT NULL DEFAULT 60,
  invite_expires_at timestamptz,
  poll_mode poll_mode NOT NULL DEFAULT 'evening_morning',
  evening_time time NOT NULL DEFAULT '20:00',
  morning_offset_min int NOT NULL DEFAULT 60,
  summary_offset_min int NOT NULL DEFAULT 15,
  quiet_from time NOT NULL DEFAULT '23:00',
  quiet_to time NOT NULL DEFAULT '07:00',
  work_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  semester_start date, semester_end date,
  absence_warn_threshold int NOT NULL DEFAULT 5,
  show_group_counts_to_students boolean NOT NULL DEFAULT false,
  deputy_can_edit_schedule boolean NOT NULL DEFAULT false,
  deputy_can_announce boolean NOT NULL DEFAULT false,
  deputy_can_see_reasons boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'dark',
  background text NOT NULL DEFAULT 'gradient',
  onboarding jsonb NOT NULL DEFAULT '{"shared":false,"schedule":false,"journal":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== memberships ==========
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'student',
  status member_status NOT NULL DEFAULT 'pending',
  full_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (group_id, user_id)
);
CREATE UNIQUE INDEX one_headman_per_group ON memberships(group_id) WHERE role='headman' AND status='active';
CREATE UNIQUE INDEX one_group_per_user ON memberships(user_id) WHERE status IN ('active','pending');
CREATE INDEX memberships_group_idx ON memberships(group_id, status);

-- ========== roster ==========
CREATE TABLE roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  full_name text NOT NULL,
  membership_id uuid REFERENCES memberships ON DELETE SET NULL,
  UNIQUE (group_id, full_name)
);

-- ========== subgroups ==========
CREATE TABLE subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (group_id, name)
);

-- ========== membership_subgroups ==========
CREATE TABLE membership_subgroups (
  membership_id uuid REFERENCES memberships ON DELETE CASCADE,
  subgroup_id uuid REFERENCES subgroups ON DELETE CASCADE,
  PRIMARY KEY (membership_id, subgroup_id)
);

-- ========== bell_schedule ==========
CREATE TABLE bell_schedule (
  group_id uuid REFERENCES groups ON DELETE CASCADE,
  lesson_no smallint NOT NULL CHECK (lesson_no BETWEEN 1 AND 12),
  starts time NOT NULL, ends time NOT NULL,
  PRIMARY KEY (group_id, lesson_no)
);

-- ========== schedule_slots ==========
CREATE TABLE schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  lesson_no smallint NOT NULL,
  starts time NOT NULL, ends time NOT NULL,
  subject text NOT NULL, teacher text, room text,
  kind lesson_kind NOT NULL DEFAULT 'lecture',
  parity week_parity NOT NULL DEFAULT 'all',
  subgroup_id uuid REFERENCES subgroups ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX slots_group_idx ON schedule_slots(group_id, weekday);

-- ========== schedule_versions ==========
CREATE TABLE schedule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  author_membership_id uuid REFERENCES memberships ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, version)
);

-- ========== schedule_drafts ==========
CREATE TABLE schedule_drafts (
  group_id uuid PRIMARY KEY REFERENCES groups ON DELETE CASCADE,
  data jsonb NOT NULL, source text NOT NULL,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== schedule_imports ==========
CREATE TABLE schedule_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  file_hash text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, file_hash)
);

-- ========== schedule_overrides ==========
CREATE TABLE schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  date date NOT NULL,
  slot_id uuid NOT NULL REFERENCES schedule_slots ON DELETE CASCADE,
  action override_action NOT NULL,
  new_starts time, new_ends time, new_room text, new_subject text, new_teacher text,
  note text,
  created_by uuid REFERENCES memberships ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX overrides_idx ON schedule_overrides(group_id, date);

-- ========== holidays ==========
CREATE TABLE holidays (
  group_id uuid REFERENCES groups ON DELETE CASCADE,
  date date NOT NULL, note text,
  PRIMARY KEY (group_id, date)
);

-- ========== planned_attendance ==========
CREATE TABLE planned_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships ON DELETE CASCADE,
  date date NOT NULL,
  slot_id uuid NOT NULL REFERENCES schedule_slots ON DELETE CASCADE,
  answer answer_kind NOT NULL,
  reason absence_reason,
  comment text,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, date, slot_id)
);

-- ========== absences ==========
CREATE TABLE absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships ON DELETE CASCADE,
  date_from date NOT NULL, date_to date,
  reason absence_reason NOT NULL,
  comment text,
  closed_at timestamptz,
  last_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX absences_idx ON absences(group_id, membership_id, date_from);

-- ========== recurring_absences ==========
CREATE TABLE recurring_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  lesson_nos smallint[] NOT NULL,
  reason absence_reason NOT NULL, comment text
);

-- ========== actual_attendance ==========
CREATE TABLE actual_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships ON DELETE CASCADE,
  date date NOT NULL,
  slot_id uuid NOT NULL REFERENCES schedule_slots ON DELETE CASCADE,
  status fact_status NOT NULL,
  set_by uuid REFERENCES memberships ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, date, slot_id)
);

-- ========== day_state ==========
CREATE TABLE day_state (
  group_id uuid REFERENCES groups ON DELETE CASCADE,
  date date NOT NULL,
  summary_sent_at timestamptz,
  closed_at timestamptz, closed_by uuid REFERENCES memberships ON DELETE SET NULL,
  PRIMARY KEY (group_id, date)
);

-- ========== announcements ==========
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES memberships ON DELETE SET NULL,
  title text NOT NULL, body text NOT NULL,
  attachment_path text,
  urgent boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','subgroups','people')),
  send_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  edited_at timestamptz, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX announcements_group_idx ON announcements(group_id);

-- ========== announcement_audience ==========
CREATE TABLE announcement_audience (
  announcement_id uuid REFERENCES announcements ON DELETE CASCADE,
  subgroup_id uuid REFERENCES subgroups ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships ON DELETE CASCADE
);

-- ========== announcement_reads ==========
CREATE TABLE announcement_reads (
  announcement_id uuid REFERENCES announcements ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships ON DELETE CASCADE,
  read_at timestamptz,
  reminders_sent smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (announcement_id, membership_id)
);

-- ========== announcement_templates ==========
CREATE TABLE announcement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL
);

-- ========== deliveries ==========
CREATE TABLE deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  group_id uuid REFERENCES groups ON DELETE CASCADE,
  user_id uuid REFERENCES users ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status delivery_status NOT NULL DEFAULT 'queued',
  attempts smallint NOT NULL DEFAULT 0,
  send_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz, error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deliveries_due ON deliveries(status, send_at);

-- ========== leadership_events ==========
CREATE TABLE leadership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  type text NOT NULL,
  actor_id uuid, target_id uuid, payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== transfer_requests ==========
CREATE TABLE transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  from_id uuid NOT NULL REFERENCES memberships ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES memberships ON DELETE CASCADE,
  keep_as_deputy boolean NOT NULL DEFAULT false,
  status request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  revert_until timestamptz
);

-- ========== votes ==========
CREATE TABLE votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  status vote_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  extended boolean NOT NULL DEFAULT false
);

-- ========== vote_candidates ==========
CREATE TABLE vote_candidates (
  vote_id uuid REFERENCES votes ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships ON DELETE CASCADE,
  PRIMARY KEY (vote_id, membership_id)
);

-- ========== vote_ballots ==========
CREATE TABLE vote_ballots (
  vote_id uuid REFERENCES votes ON DELETE CASCADE,
  voter_id uuid REFERENCES memberships ON DELETE CASCADE,
  candidate_id uuid REFERENCES memberships ON DELETE CASCADE,
  PRIMARY KEY (vote_id, voter_id)
);

-- ========== bug_reports ==========
CREATE TABLE bug_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES users ON DELETE SET NULL,
  group_id uuid REFERENCES groups ON DELETE SET NULL,
  text text NOT NULL, screenshot_path text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status ticket_status NOT NULL DEFAULT 'new',
  dup_of bigint REFERENCES bug_reports, dup_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);

-- ========== complaints ==========
CREATE TABLE complaints (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES users ON DELETE SET NULL,
  group_id uuid REFERENCES groups ON DELETE SET NULL,
  text text NOT NULL, status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== audit_log ==========
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id uuid REFERENCES groups ON DELETE CASCADE,
  actor_id uuid, action text NOT NULL, entity text, entity_id text, diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_group_idx ON audit_log(group_id, created_at DESC);

-- ========== rate_limits ==========
CREATE TABLE rate_limits (
  key text NOT NULL, window_start timestamptz NOT NULL, count int NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

-- ========== gemini_usage ==========
CREATE TABLE gemini_usage (
  day date NOT NULL, group_id uuid REFERENCES groups ON DELETE CASCADE, count int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, group_id)
);

-- ========== weekly_reports ==========
CREATE TABLE weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
  week_start date NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, week_start)
);

-- ========== RLS: enable on all tables, no policies ==========
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- ========== Grant service_role full access ==========
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', t);
  END LOOP;
END $$;

-- Grant USAGE on sequences for identity columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
