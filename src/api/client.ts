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
  DayPollResponse,
  PollAnswerInput,
  CreateAbsenceInput,
} from './types';

export interface ApiClient {
  getMe(): Promise<MeResponse>;
  createGroup(input: {
    name: string;
    institution?: string;
    course?: number;
    timezone: string;
    full_name: string;
  }): Promise<CreateGroupResponse>;
  joinGroup(input: {
    token?: string;
    code?: string;
    full_name: string;
    roster_id?: string;
    subgroup_ids?: string[];
    consent: boolean;
  }): Promise<Membership>;
  restoreGroup(recovery_code: string): Promise<Membership>;
  getInvite(): Promise<InviteResponse>;
  regenerateInvite(): Promise<InviteResponse>;
  regenerateRecovery(): Promise<{ recovery_code: string }>;
  getGroupSettings(): Promise<Group>;
  updateGroupSettings(input: Partial<Group>): Promise<Group>;
  deleteGroup(): Promise<void>;
  restoreDeletion(): Promise<void>;
  getMembers(): Promise<Membership[]>;
  approveMember(id: string): Promise<void>;
  rejectMember(id: string): Promise<void>;
  removeMember(id: string): Promise<void>;
  updateMemberSubgroups(id: string, subgroup_ids: string[]): Promise<void>;
  updateMemberRole(id: string, role: 'student' | 'deputy'): Promise<void>;
  getRoster(): Promise<RosterEntry[]>;
  addRoster(names: string[]): Promise<void>;
  deleteRoster(id: string): Promise<void>;
  getSubgroups(): Promise<Subgroup[]>;
  createSubgroup(name: string): Promise<Subgroup>;
  deleteSubgroup(id: string): Promise<void>;
  leaveGroup(successor_id?: string): Promise<void>;
  getMyData(): Promise<Record<string, unknown>>;
  deleteMyData(): Promise<void>;
  updateMeSettings(input: {
    theme?: string;
    background?: string;
    reduce_motion?: boolean;
    lesson_reminder_minutes?: number | null;
    timezone?: string | null;
  }): Promise<void>;
  getSchedule(from: string, to: string): Promise<DaySchedule[]>;
  getScheduleRaw(): Promise<{ slots: Slot[]; bell: BellEntry[] }>;
  getDayPoll(date: string): Promise<DayPollResponse>;
  submitPollAnswers(input: { date: string; answers: PollAnswerInput[] }): Promise<void>;
  createAbsence(input: CreateAbsenceInput): Promise<unknown>;
  saveScheduleDraft(input: { slots: Slot[]; bell: BellEntry[] }): Promise<void>;
  publishSchedule(): Promise<void>;
  getScheduleVersions(): Promise<{ id: string; version: number; created_at: string }[]>;
  rollbackSchedule(version: number): Promise<void>;
  getJournal(date: string): Promise<JournalDay>;
  getJournalRange(from: string, to: string): Promise<JournalDay[]>;
  setAttendance(input: {
    membership_id: string;
    date: string;
    slot_id: string;
    status: string | null;
  }): Promise<void>;
  closeDay(date: string, force?: boolean): Promise<void>;
  reopenDay(date: string): Promise<void>;
  getStats(from: string, to: string): Promise<StatsSummary>;
  getMyStats(): Promise<MyStats>;
  nudgeUnanswered(): Promise<void>;
  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(input: {
    title: string;
    body: string;
    urgent?: boolean;
    pinned?: boolean;
    audience?: 'all' | 'subgroups' | 'people';
    send_at?: string;
  }): Promise<Announcement>;
  deleteAnnouncement(id: string): Promise<void>;
  markAnnouncementRead(id: string): Promise<void>;
  markAllAnnouncementsRead(): Promise<void>;
  getAnnouncementReaders(id: string): Promise<{ membership_id: string; full_name: string; read: boolean; bot_blocked: boolean }[]>;
  nudgeUnread(id: string): Promise<void>;
}
