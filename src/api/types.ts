import type { Role } from '@/lib/permissions';
import type { Slot } from '@/lib/rules';

export interface User {
  id: string;
  telegram_id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  theme: string;
  background: string;
  reduce_motion: boolean;
  lesson_reminder_minutes: number | null;
  timezone?: string | null;
  bot_blocked: boolean;
}

export interface Membership {
  id: string;
  group_id: string;
  user_id: string;
  role: Role;
  status: 'pending' | 'active' | 'removed' | 'left';
  full_name: string;
  joined_at: string;
  left_at?: string | null;
}

export interface Subgroup {
  id: string;
  group_id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  institution?: string | null;
  course?: number | null;
  timezone: string;
  state: 'active' | 'no_headman' | 'pending_deletion';
  delete_after?: string | null;
  short_code?: string | null;
  join_mode: 'approval' | 'auto';
  member_limit: number;
  poll_mode: 'evening_morning' | 'morning' | 'evening';
  evening_time: string;
  morning_offset_min: number;
  summary_offset_min: number;
  quiet_from: string;
  quiet_to: string;
  work_days: number[];
  semester_start?: string | null;
  semester_end?: string | null;
  absence_warn_threshold: number;
  show_group_counts_to_students: boolean;
  deputy_can_edit_schedule: boolean;
  deputy_can_announce: boolean;
  deputy_can_see_reasons: boolean;
  theme: string;
  background: string;
  onboarding: { shared: boolean; schedule: boolean; journal: boolean };
}

export interface RosterEntry {
  id: string;
  group_id: string;
  full_name: string;
  membership_id?: string | null;
}

export interface Announcement {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  body: string;
  attachment_path?: string | null;
  urgent: boolean;
  pinned: boolean;
  audience: 'all' | 'subgroups' | 'people';
  send_at: string;
  published_at?: string | null;
  created_at: string;
  unread?: boolean;
  read_count?: number;
  total_count?: number;
}

export interface BellEntry {
  lesson_no: number;
  starts: string;
  ends: string;
}

export interface DaySchedule {
  date: string;
  slots: (Slot & { cancelled?: boolean; moved?: boolean })[];
}

export interface JournalRow {
  membership_id: string;
  full_name: string;
  cells: {
    slot_id: string;
    status: import('@/lib/rules').EffectiveStatus;
    confirmed: boolean;
  }[];
}

export interface JournalDay {
  date: string;
  closed: boolean;
  rows: JournalRow[];
  slots: Slot[];
}

export interface StatsSummary {
  total_slots: number;
  present: number;
  late: number;
  absent: number;
  valid: number;
  sick: number;
  no_data: number;
  cancelled: number;
  rate: number | null;
  rate_with_valid: number | null;
}

export interface MyStats {
  visited: number;
  missed: number;
  sick: number;
  valid: number;
  rate: number | null;
}

export interface MeResponse {
  user: User;
  membership: Membership | null;
  group: Group | null;
  subgroups: Subgroup[];
  unread_announcements: number;
  onboarding: { shared: boolean; schedule: boolean; journal: boolean };
}

export interface CreateGroupResponse {
  group: Group;
  invite: { link: string; code: string };
  recovery_code: string;
}

export interface InviteResponse {
  link: string;
  code: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}
