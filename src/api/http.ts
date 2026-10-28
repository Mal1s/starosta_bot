import type { ApiClient } from './client';
import type { ApiResponse } from './types';
import { getInitData } from '@/lib/telegram';

const BASE_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`
  : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json: ApiResponse<T> = await res.json();

  if (!json.ok || !json.data) {
    throw new Error(json.error?.message ?? 'Request failed');
  }
  return json.data;
}

export const httpApiClient: ApiClient = {
  getMe: () => request('/me'),
  createGroup: (input) =>
    request('/groups', { method: 'POST', body: JSON.stringify(input) }),
  joinGroup: (input) =>
    request('/groups/join', { method: 'POST', body: JSON.stringify(input) }),
  restoreGroup: (recovery_code) =>
    request('/groups/restore', { method: 'POST', body: JSON.stringify({ recovery_code }) }),
  getInvite: () => request('/groups/invite'),
  regenerateInvite: () =>
    request('/groups/invite/regenerate', { method: 'POST' }),
  regenerateRecovery: () =>
    request('/groups/recovery/regenerate', { method: 'POST' }),
  getGroupSettings: () => request('/groups/settings'),
  updateGroupSettings: (input) =>
    request('/groups/settings', { method: 'PUT', body: JSON.stringify(input) }),
  deleteGroup: () => request('/groups', { method: 'DELETE' }),
  restoreDeletion: () =>
    request('/groups/restore-deletion', { method: 'POST' }),
  getMembers: () => request('/members'),
  approveMember: (id) =>
    request(`/members/${id}/approve`, { method: 'POST' }),
  rejectMember: (id) =>
    request(`/members/${id}/reject`, { method: 'POST' }),
  removeMember: (id) =>
    request(`/members/${id}/remove`, { method: 'POST' }),
  updateMemberSubgroups: (id, subgroup_ids) =>
    request(`/members/${id}/subgroups`, { method: 'PUT', body: JSON.stringify({ subgroup_ids }) }),
  updateMemberRole: (id, role) =>
    request(`/members/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  getRoster: () => request('/roster'),
  addRoster: (names) =>
    request('/roster', { method: 'POST', body: JSON.stringify({ names }) }),
  deleteRoster: (id) =>
    request(`/roster/${id}`, { method: 'DELETE' }),
  getSubgroups: () => request('/subgroups'),
  createSubgroup: (name) =>
    request('/subgroups', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteSubgroup: (id) =>
    request(`/subgroups/${id}`, { method: 'DELETE' }),
  leaveGroup: (successor_id) =>
    request('/leave', { method: 'POST', body: JSON.stringify({ successor_id }) }),
  getMyData: () => request('/my-data'),
  deleteMyData: () => request('/my-data', { method: 'DELETE' }),
  updateMeSettings: (input) =>
    request('/me/settings', { method: 'PUT', body: JSON.stringify(input) }),
  getSchedule: (from, to) =>
    request(`/schedule?from=${from}&to=${to}`),
  getScheduleRaw: () => request('/schedule/raw'),
  saveScheduleDraft: (input) =>
    request('/schedule/draft', { method: 'PUT', body: JSON.stringify(input) }),
  publishSchedule: () =>
    request('/schedule/publish', { method: 'POST' }),
  getScheduleVersions: () => request('/schedule/versions'),
  rollbackSchedule: (version) =>
    request(`/schedule/versions/${version}/rollback`, { method: 'POST' }),
  getJournal: (date) => request(`/journal?date=${date}`),
  getJournalRange: (from, to) =>
    request(`/journal/range?from=${from}&to=${to}`),
  setAttendance: (input) =>
    request('/attendance', { method: 'PUT', body: JSON.stringify(input) }),
  closeDay: (date, force) =>
    request('/attendance/close-day', { method: 'POST', body: JSON.stringify({ date, force }) }),
  reopenDay: (date) =>
    request('/attendance/reopen-day', { method: 'POST', body: JSON.stringify({ date }) }),
  getStats: (from, to) => request(`/stats?from=${from}&to=${to}`),
  getMyStats: () => request('/stats/me'),
  nudgeUnanswered: () =>
    request('/summary/nudge', { method: 'POST' }),
  getAnnouncements: () => request('/announcements'),
  createAnnouncement: (input) =>
    request('/announcements', { method: 'POST', body: JSON.stringify(input) }),
  deleteAnnouncement: (id) =>
    request(`/announcements/${id}`, { method: 'DELETE' }),
  markAnnouncementRead: (id) =>
    request(`/announcements/${id}/read`, { method: 'POST' }),
  markAllAnnouncementsRead: () =>
    request('/announcements/read-all', { method: 'POST' }),
  getAnnouncementReaders: (id) =>
    request(`/announcements/${id}/readers`),
  nudgeUnread: (id) =>
    request(`/announcements/${id}/nudge`, { method: 'POST' }),
};
