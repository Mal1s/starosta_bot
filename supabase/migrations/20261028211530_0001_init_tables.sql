/*
# Starosta Bot: Core Database Schema

Creates all tables for the Telegram Mini App attendance tracker.
RLS enabled on all tables; all access through Edge Functions with service_role.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========== users ==========
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  first_name text,
  last_name text,
  username text,
  language_code text DEFAULT 'ru',
  theme text NOT NULL DEFAULT 'dark',
  background text NOT NULL DEFAULT 'gradient',
  reduce_motion boolean NOT NULL DEFAULT false,
  lesson_reminder_minutes integer,
  timezone text DEFAULT 'Europe/Moscow',
  bot_blocked boolean NOT NULL DEFAULT false,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== groups ==========
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  institution text,
  course integer,
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  state text NOT NULL DEFAULT 'active',
  delete_after timestamptz,
  invite_token text UNIQUE,
  short_code text UNIQUE,
  invite_expires_at timestamptz,
  join_mode text NOT NULL DEFAULT 'approval',
  member_limit integer NOT NULL DEFAULT 60,
  poll_mode text NOT NULL DEFAULT 'evening_morning',
  evening_time text NOT NULL DEFAULT '20:00',
  morning_offset_min integer NOT NULL DEFAULT 60,
  summary_offset_min integer NOT NULL DEFAULT 15,
  quiet_from text NOT NULL DEFAULT '23:00',
  quiet_to text NOT NULL DEFAULT '07:00',
  work_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  semester_start date,
  semester_end date,
  absence_warn_threshold integer NOT NULL DEFAULT 5,
  show_group_counts_to_students boolean NOT NULL DEFAULT false,
  deputy_can_edit_schedule boolean NOT NULL DEFAULT true,
  deputy_can_announce boolean NOT NULL DEFAULT true,
  deputy_can_see_reasons boolean NOT NULL DEFAULT false,
  recovery_code_hash text,
  theme text NOT NULL DEFAULT 'dark',
  background text NOT NULL DEFAULT 'gradient',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== memberships ==========
CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student',
  status text NOT NULL DEFAULT 'pending',
  full_name text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_group ON memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);

-- ========== subgroups ==========
CREATE TABLE IF NOT EXISTS subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subgroups_group ON subgroups(group_id);

-- ========== member_subgroups ==========
CREATE TABLE IF NOT EXISTS member_subgroups (
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  subgroup_id uuid NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  PRIMARY KEY(membership_id, subgroup_id)
);

-- ========== roster ==========
CREATE TABLE IF NOT EXISTS roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roster_group ON roster(group_id);

-- ========== bell_schedule ==========
CREATE TABLE IF NOT EXISTS bell_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  lesson_no integer NOT NULL,
  starts text NOT NULL,
  ends text NOT NULL,
  UNIQUE(group_id, lesson_no)
);

-- ========== schedule_slots ==========
CREATE TABLE IF NOT EXISTS schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  lesson_no integer NOT NULL,
  starts text NOT NULL,
  ends text NOT NULL,
  subject text NOT NULL,
  teacher text,
  room text,
  kind text NOT NULL DEFAULT 'other',
  parity text NOT NULL DEFAULT 'all',
  subgroup_id uuid REFERENCES subgroups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slots_group_weekday ON schedule_slots(group_id, weekday);

-- ========== schedule_overrides ==========
CREATE TABLE IF NOT EXISTS schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date date NOT NULL,
  slot_id uuid NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  action text NOT NULL,
  new_starts text,
  new_ends text,
  new_room text,
  new_subject text,
  new_teacher text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_overrides_group_date ON schedule_overrides(group_id, date);

-- ========== schedule_versions ==========
CREATE TABLE IF NOT EXISTS schedule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_versions_group ON schedule_versions(group_id);

-- ========== schedule_drafts ==========
CREATE TABLE IF NOT EXISTS schedule_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slots jsonb NOT NULL,
  flags jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== schedule_imports ==========
CREATE TABLE IF NOT EXISTS schedule_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  file_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, file_hash)
);

-- ========== holidays ==========
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date date NOT NULL,
  note text,
  UNIQUE(group_id, date)
);

-- ========== planned_attendance ==========
CREATE TABLE IF NOT EXISTS planned_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  date date NOT NULL,
  slot_id uuid NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  answer text NOT NULL,
  reason text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(membership_id, date, slot_id)
);
CREATE INDEX IF NOT EXISTS idx_planned_date ON planned_attendance(date);

-- ========== actual_attendance ==========
CREATE TABLE IF NOT EXISTS actual_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  date date NOT NULL,
  slot_id uuid NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  status text NOT NULL,
  set_by uuid REFERENCES users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(membership_id, date, slot_id)
);
CREATE INDEX IF NOT EXISTS idx_actual_date ON actual_attendance(date);

-- ========== absences ==========
CREATE TABLE IF NOT EXISTS absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_absences_member ON absences(membership_id);

-- ========== recurring_absences ==========
CREATE TABLE IF NOT EXISTS recurring_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  lesson_nos integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(membership_id, weekday)
);

-- ========== day_state ==========
CREATE TABLE IF NOT EXISTS day_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date date NOT NULL,
  closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(group_id, date)
);

-- ========== announcements ==========
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  attachment_path text,
  urgent boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  audience text NOT NULL DEFAULT 'all',
  audience_targets jsonb,
  send_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ann_group ON announcements(group_id);

-- ========== announcement_reads ==========
CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(announcement_id, membership_id)
);

-- ========== deliveries ==========
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES memberships(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- ========== leadership_events ==========
CREATE TABLE IF NOT EXISTS leadership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_headman_id uuid,
  new_headman_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== transfer_requests ==========
CREATE TABLE IF NOT EXISTS transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== votes ==========
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  candidate_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  voter_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_membership_id, voter_membership_id)
);

-- ========== audit_log ==========
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_group ON audit_log(group_id);

-- ========== bug_reports ==========
CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  message text NOT NULL,
  screenshot_path text,
  context jsonb,
  status text NOT NULL DEFAULT 'open',
  dup_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== weekly_reports ==========
CREATE TABLE IF NOT EXISTS weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, week_start)
);
