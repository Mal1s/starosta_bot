import type { ApiClient } from '@/api/client';
import type {
  MeResponse,
  CreateGroupResponse,
  InviteResponse,
  Group,
  Membership,
  Subgroup,
  RosterEntry,
  Announcement,
  DaySchedule,
  JournalDay,
  StatsSummary,
  MyStats,
  Slot,
  BellEntry,
  PollAnswerInput,
  CreateAbsenceInput,
} from '@/api/types';
import type { EffectiveStatus } from '@/lib/rules';

type DevRole = 'headman' | 'deputy' | 'student1' | 'student2';

function uuid(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- Demo data setup ---

const groupId = uuid();
const sub1Id = uuid();
const sub2Id = uuid();

const users = new Map<string, { id: string; telegram_id: number; first_name: string; last_name: string; theme: string; background: string; reduce_motion: boolean; lesson_reminder_minutes: number | null; timezone: string; bot_blocked: boolean }>([
  ['headman', { id: uuid(), telegram_id: 100001, first_name: 'Иван', last_name: 'Иванов', theme: 'dark', background: 'gradient', reduce_motion: false, lesson_reminder_minutes: 30, timezone: 'Europe/Moscow', bot_blocked: false }],
  ['deputy', { id: uuid(), telegram_id: 100002, first_name: 'Анна', last_name: 'Смирнова', theme: 'dark', background: 'gradient', reduce_motion: false, lesson_reminder_minutes: 30, timezone: 'Europe/Moscow', bot_blocked: false }],
  ['student1', { id: uuid(), telegram_id: 100003, first_name: 'Пётр', last_name: 'Козлов', theme: 'sky', background: 'gradient', reduce_motion: false, lesson_reminder_minutes: 30, timezone: 'Europe/Moscow', bot_blocked: false }],
  ['student2', { id: uuid(), telegram_id: 100004, first_name: 'Мария', last_name: 'Петрова', theme: 'pink', background: 'minimal', reduce_motion: false, lesson_reminder_minutes: null, timezone: 'Europe/Moscow', bot_blocked: false }],
]);

const memberships = new Map<string, Membership>([
  ['headman', { id: uuid(), group_id: groupId, user_id: users.get('headman')!.id, role: 'headman', status: 'active', full_name: 'Иванов Иван', joined_at: nowISO() }],
  ['deputy', { id: uuid(), group_id: groupId, user_id: users.get('deputy')!.id, role: 'deputy', status: 'active', full_name: 'Смирнова Анна', joined_at: nowISO() }],
  ['student1', { id: uuid(), group_id: groupId, user_id: users.get('student1')!.id, role: 'student', status: 'active', full_name: 'Козлов Пётр', joined_at: nowISO() }],
  ['student2', { id: uuid(), group_id: groupId, user_id: users.get('student2')!.id, role: 'student', status: 'active', full_name: 'Петрова Мария', joined_at: nowISO() }],
]);

// Extra demo students
const extraNames = ['Сидоров Алексей', 'Морозова Екатерина', 'Волков Дмитрий', 'Зайцева Ольга', 'Новиков Сергей', 'Фёдорова Наталья', 'Орлов Андрей', 'Белова Татьяна'];
for (const name of extraNames) {
  const key = `extra-${name}`;
  memberships.set(key, { id: uuid(), group_id: groupId, user_id: uuid(), role: 'student', status: 'active', full_name: name, joined_at: nowISO() });
}

const demoGroup: Group = {
  id: groupId,
  name: 'ПИ-21',
  institution: 'МГУ',
  course: 3,
  timezone: 'Europe/Moscow',
  state: 'active',
  short_code: 'K7M-4Q2',
  join_mode: 'approval',
  member_limit: 60,
  poll_mode: 'evening_morning',
  evening_time: '20:00',
  morning_offset_min: 60,
  summary_offset_min: 15,
  quiet_from: '23:00',
  quiet_to: '07:00',
  work_days: [1, 2, 3, 4, 5],
  semester_start: '2026-09-01',
  semester_end: '2026-12-31',
  absence_warn_threshold: 5,
  show_group_counts_to_students: false,
  deputy_can_edit_schedule: true,
  deputy_can_announce: true,
  deputy_can_see_reasons: false,
  theme: 'dark',
  background: 'gradient',
  onboarding: { shared: true, schedule: true, journal: false },
};

const subgroups: Subgroup[] = [
  { id: sub1Id, group_id: groupId, name: 'Англ-1' },
  { id: sub2Id, group_id: groupId, name: 'Англ-2' },
  { id: uuid(), group_id: groupId, name: 'Физ-1' },
  { id: uuid(), group_id: groupId, name: 'Физ-2' },
];

const rosterEntries: RosterEntry[] = [
  { id: uuid(), group_id: groupId, full_name: 'Александров Дмитрий' },
  { id: uuid(), group_id: groupId, full_name: 'Борисова Елена' },
  { id: uuid(), group_id: groupId, full_name: 'Васильев Игорь' },
  { id: uuid(), group_id: groupId, full_name: 'Григорьева Ольга' },
  { id: uuid(), group_id: groupId, full_name: 'Дмитриев Сергей' },
  { id: uuid(), group_id: groupId, full_name: 'Егорова Анна' },
  { id: uuid(), group_id: groupId, full_name: 'Жуков Алексей' },
  { id: uuid(), group_id: groupId, full_name: 'Зайцева Мария' },
];

const bellSchedule: BellEntry[] = [
  { lesson_no: 1, starts: '08:30', ends: '10:00' },
  { lesson_no: 2, starts: '10:10', ends: '11:40' },
  { lesson_no: 3, starts: '12:00', ends: '13:30' },
  { lesson_no: 4, starts: '13:40', ends: '15:10' },
  { lesson_no: 5, starts: '15:20', ends: '16:50' },
  { lesson_no: 6, starts: '17:00', ends: '18:30' },
];

const scheduleSlots: Slot[] = [
  { id: uuid(), weekday: 1, lesson_no: 1, starts: '08:30', ends: '10:00', subject: 'Математика', teacher: 'Иванов И.И.', room: '305', kind: 'lecture', parity: 'all', subgroup_id: null },
  { id: uuid(), weekday: 1, lesson_no: 2, starts: '10:10', ends: '11:40', subject: 'Физика', teacher: 'Петров П.П.', room: '201', kind: 'practice', parity: 'all', subgroup_id: null },
  { id: uuid(), weekday: 1, lesson_no: 3, starts: '12:00', ends: '13:30', subject: 'Английский', teacher: 'Smith J.', room: '110', kind: 'practice', parity: 'all', subgroup_id: sub1Id, subgroup_name: 'Англ-1' },
  { id: uuid(), weekday: 2, lesson_no: 1, starts: '08:30', ends: '10:00', subject: 'Программирование', teacher: 'Сидоров С.С.', room: '401', kind: 'lab', parity: 'all', subgroup_id: null },
  { id: uuid(), weekday: 2, lesson_no: 2, starts: '10:10', ends: '11:40', subject: 'Математика', teacher: 'Иванов И.И.', room: '305', kind: 'lecture', parity: 'odd', subgroup_id: null },
  { id: uuid(), weekday: 3, lesson_no: 1, starts: '08:30', ends: '10:00', subject: 'Базы данных', teacher: 'Кузнецов К.К.', room: '402', kind: 'lab', parity: 'all', subgroup_id: sub2Id, subgroup_name: 'Англ-2' },
  { id: uuid(), weekday: 3, lesson_no: 3, starts: '12:00', ends: '13:30', subject: 'Философия', teacher: 'Морозова М.М.', room: '150', kind: 'lecture', parity: 'all', subgroup_id: null },
  { id: uuid(), weekday: 4, lesson_no: 2, starts: '10:10', ends: '11:40', subject: 'Английский', teacher: 'Smith J.', room: '110', kind: 'practice', parity: 'all', subgroup_id: sub2Id, subgroup_name: 'Англ-2' },
  { id: uuid(), weekday: 5, lesson_no: 1, starts: '08:30', ends: '10:00', subject: 'Математика', teacher: 'Иванов И.И.', room: '305', kind: 'lecture', parity: 'all', subgroup_id: null },
  { id: uuid(), weekday: 5, lesson_no: 4, starts: '13:40', ends: '15:10', subject: 'Программирование', teacher: 'Сидоров С.С.', room: '401', kind: 'lab', parity: 'even', subgroup_id: null },
];

const announcements: Announcement[] = [
  { id: uuid(), group_id: groupId, author_id: memberships.get('headman')!.id, title: 'Собрание в пятницу', body: 'В пятницу в 14:00 собрание группы в аудитории 305. Явка обязательна!', urgent: false, pinned: true, audience: 'all', send_at: nowISO(), published_at: nowISO(), created_at: nowISO(), unread: true, read_count: 5, total_count: 12 },
  { id: uuid(), group_id: groupId, author_id: memberships.get('headman')!.id, title: 'Сдача лабораторных', body: 'Напоминаю, что сдача лабораторных по программированию — до 15 ноября.', urgent: false, pinned: false, audience: 'all', send_at: nowISO(), published_at: nowISO(), created_at: nowISO(), unread: false, read_count: 12, total_count: 12 },
];

let currentDevRole: DevRole = 'headman';
const membershipSubgroups = new Map<string, string[]>([
  [memberships.get('student1')!.id, [sub1Id]],
  [memberships.get('student2')!.id, [sub2Id]],
]);
const plannedAnswers = new Map<string, Map<string, PollAnswerInput>>();
const actualAttendance = new Map<string, EffectiveStatus>();
const closedDays = new Set<string>();

export function setDevRole(role: DevRole) {
  currentDevRole = role;
}

export function getDevRole(): DevRole {
  return currentDevRole;
}

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function currentMembership(): Membership {
  return memberships.get(currentDevRole)!;
}

function currentUser() {
  return users.get(currentDevRole)!;
}

function slotsForDate(date: string): Slot[] {
  const day = new Date(date + 'T00:00:00Z').getUTCDay();
  const weekday = day === 0 ? 7 : day;
  return scheduleSlots.filter((s) => s.weekday === weekday);
}

function studentSlots(date: string, membershipId: string): (Slot & { cancelled?: boolean; moved?: boolean })[] {
  const subIds = membershipSubgroups.get(membershipId) ?? [];
  return slotsForDate(date).filter((s) => s.subgroup_id === null || subIds.includes(s.subgroup_id ?? ''));
}

export const mockApiClient: ApiClient = {
  getMe: () => {
    const u = currentUser();
    const m = currentMembership();
    return delay<MeResponse>({
      user: {
        id: u.id,
        telegram_id: u.telegram_id,
        first_name: u.first_name,
        last_name: u.last_name,
        theme: u.theme,
        background: u.background,
        reduce_motion: u.reduce_motion,
        lesson_reminder_minutes: u.lesson_reminder_minutes,
        timezone: u.timezone,
        bot_blocked: u.bot_blocked,
      },
      membership: m,
      group: demoGroup,
      subgroups,
      unread_announcements: announcements.filter((a) => a.unread).length,
      onboarding: demoGroup.onboarding,
    });
  },

  createGroup: (input) => {
    const code = 'K7M-4Q2';
    return delay<CreateGroupResponse>({
      group: { ...demoGroup, name: input.name, timezone: input.timezone },
      invite: { link: `https://t.me/starostaa_help_bot?startapp=token123`, code },
      recovery_code: 'ABCD-EFGH-JKLM',
    });
  },

  joinGroup: (input) => {
    const m: Membership = {
      id: uuid(),
      group_id: groupId,
      user_id: uuid(),
      role: 'student',
      status: demoGroup.join_mode === 'auto' ? 'active' : 'pending',
      full_name: input.full_name,
      joined_at: nowISO(),
    };
    memberships.set(`join-${m.id}`, m);
    if (input.subgroup_ids && input.subgroup_ids.length > 0) {
      membershipSubgroups.set(m.id, input.subgroup_ids);
    }
    return delay(m, 600);
  },

  restoreGroup: (recovery_code) => {
    const m = currentMembership();
    return delay({ ...m, role: 'headman' });
  },

  getInvite: () =>
    delay<InviteResponse>({ link: 'https://t.me/starostaa_help_bot?startapp=token123', code: 'K7M-4Q2' }),
  regenerateInvite: () =>
    delay<InviteResponse>({ link: 'https://t.me/starostaa_help_bot?startapp=newtoken', code: 'R9P-3X8' }),
  regenerateRecovery: () =>
    delay({ recovery_code: 'WXYZ-1234-ABCD' }),

  getGroupSettings: () => delay(demoGroup),
  updateGroupSettings: (input) => delay({ ...demoGroup, ...input }),

  deleteGroup: () => delay(undefined),
  restoreDeletion: () => delay(undefined),

  getMembers: () => delay(Array.from(memberships.values())),
  approveMember: (id) => {
    const m = memberships.get(currentDevRole);
    if (m) { m.status = 'active'; }
    return delay(undefined);
  },
  rejectMember: () => delay(undefined),
  removeMember: () => delay(undefined),
  updateMemberSubgroups: (id, subgroup_ids) => {
    membershipSubgroups.set(id, subgroup_ids);
    return delay(undefined);
  },
  updateMemberRole: () => delay(undefined),

  getRoster: () => delay<RosterEntry[]>(rosterEntries),
  addRoster: () => delay(undefined),
  deleteRoster: () => delay(undefined),

  getSubgroups: () => delay(subgroups),
  createSubgroup: (name) => {
    const sg = { id: uuid(), group_id: groupId, name };
    subgroups.push(sg);
    return delay(sg);
  },
  deleteSubgroup: () => delay(undefined),

  leaveGroup: () => delay(undefined),

  getMyData: () => delay<Record<string, unknown>>({ full_name: 'Иванов Иван', answers: 45, marks: 40 }),
  deleteMyData: () => delay(undefined),

  updateMeSettings: (input) => {
    const u = currentUser();
    if (input.theme) u.theme = input.theme;
    if (input.background) u.background = input.background;
    if (input.reduce_motion !== undefined) u.reduce_motion = input.reduce_motion;
    if (input.lesson_reminder_minutes !== undefined) u.lesson_reminder_minutes = input.lesson_reminder_minutes;
    if (input.timezone !== undefined) u.timezone = input.timezone ?? 'Europe/Moscow';
    return delay(undefined);
  },

  getSchedule: (from, to) => {
    const days: DaySchedule[] = [];
    let d = from;
    while (d <= to) {
      const daySlots = studentSlots(d, currentMembership().id);
      if (daySlots.length > 0) {
        days.push({ date: d, slots: daySlots });
      }
      d = addDays(d, 1);
    }
    return delay(days);
  },

  getScheduleRaw: () => delay({ slots: scheduleSlots, bell: bellSchedule }),
  getDayPoll: async (date) => {
    const days = await mockApiClient.getSchedule(date, date);
    return delay({
      date,
      slots: days[0]?.slots ?? [],
      answers: Array.from(plannedAnswers.get(date)?.values() ?? []),
    });
  },
  submitPollAnswers: ({ date, answers }) => {
    const dayAnswers = plannedAnswers.get(date) ?? new Map<string, PollAnswerInput>();
    answers.forEach((answer) => dayAnswers.set(answer.slot_id, answer));
    plannedAnswers.set(date, dayAnswers);
    return delay(undefined);
  },
  createAbsence: (input: CreateAbsenceInput) =>
    delay({ id: uuid(), ...input }),
  saveScheduleDraft: () => delay(undefined),
  publishSchedule: () => delay(undefined),
  getScheduleVersions: () => delay([{ id: uuid(), version: 1, created_at: nowISO() }]),
  rollbackSchedule: () => delay(undefined),

  getJournal: (date) => {
    const daySlots = slotsForDate(date);
    const rows = Array.from(memberships.values())
      .filter((m) => m.status === 'active')
      .map((m) => {
        const subIds = membershipSubgroups.get(m.id) ?? [];
        const studentSlotsForDay = daySlots.filter((s) => s.subgroup_id === null || subIds.includes(s.subgroup_id ?? ''));
        return {
          membership_id: m.id,
          full_name: m.full_name,
          cells: studentSlotsForDay.map((slot) => {
            const attendanceKey = `${date}:${m.id}:${slot.id}`;
            const status: EffectiveStatus = actualAttendance.get(attendanceKey)
              ?? (m.role === 'headman' || m.role === 'deputy' ? 'present' : 'no_data');
            return { slot_id: slot.id, status, confirmed: status !== 'no_data' };
          }),
        };
      });
    return delay<JournalDay>({ date, closed: closedDays.has(date), rows, slots: daySlots });
  },

  getJournalRange: (from, to) => {
    const days: JournalDay[] = [];
    let d = from;
    while (d <= to) {
      const daySlots = slotsForDate(d);
      if (daySlots.length > 0) {
        const rows = Array.from(memberships.values())
          .filter((m) => m.status === 'active')
          .map((m) => ({
            membership_id: m.id,
            full_name: m.full_name,
            cells: daySlots.map((slot) => ({ slot_id: slot.id, status: 'no_data' as EffectiveStatus, confirmed: false })),
          }));
        days.push({ date: d, closed: false, rows, slots: daySlots });
      }
      d = addDays(d, 1);
    }
    return delay(days);
  },

  setAttendance: ({ membership_id, date, slot_id, status }) => {
    const key = `${date}:${membership_id}:${slot_id}`;
    if (status) actualAttendance.set(key, status as EffectiveStatus);
    else actualAttendance.delete(key);
    return delay(undefined);
  },
  closeDay: (date) => {
    closedDays.add(date);
    return delay(undefined);
  },
  reopenDay: (date) => {
    closedDays.delete(date);
    return delay(undefined);
  },

  getStats: (from, to) =>
    delay<StatsSummary>({
      total_slots: 120,
      present: 85,
      late: 10,
      absent: 15,
      valid: 5,
      sick: 3,
      no_data: 2,
      cancelled: 0,
      rate: (85 + 10) / (85 + 10 + 15),
      rate_with_valid: (85 + 10 + 5) / (85 + 10 + 5 + 15),
    }),

  getMyStats: () =>
    delay<MyStats>({ visited: 38, missed: 4, sick: 2, valid: 1, rate: 38 / (38 + 4) }),

  nudgeUnanswered: () => delay(undefined),

  getAnnouncements: () => delay(announcements),
  createAnnouncement: (input) => {
    const a: Announcement = {
      id: uuid(),
      group_id: groupId,
      author_id: currentMembership().id,
      title: input.title,
      body: input.body,
      urgent: input.urgent ?? false,
      pinned: input.pinned ?? false,
      audience: input.audience ?? 'all',
      send_at: input.send_at ?? nowISO(),
      published_at: nowISO(),
      created_at: nowISO(),
      unread: false,
      read_count: 0,
      total_count: 12,
    };
    announcements.unshift(a);
    return delay(a);
  },
  deleteAnnouncement: (id) => {
    const idx = announcements.findIndex((a) => a.id === id);
    if (idx >= 0) announcements.splice(idx, 1);
    return delay(undefined);
  },
  markAnnouncementRead: (id) => {
    const a = announcements.find((a) => a.id === id);
    if (a) { a.unread = false; a.read_count = (a.read_count ?? 0) + 1; }
    return delay(undefined);
  },
  markAllAnnouncementsRead: () => {
    announcements.forEach((a) => { a.unread = false; });
    return delay(undefined);
  },
  getAnnouncementReaders: (id) => {
    return delay(
      Array.from(memberships.values())
        .filter((m) => m.status === 'active')
        .map((m) => ({
          membership_id: m.id,
          full_name: m.full_name,
          read: Math.random() > 0.3,
          bot_blocked: m.full_name === 'Орлов Андрей',
        }))
    );
  },
  nudgeUnread: () => delay(undefined),
};
