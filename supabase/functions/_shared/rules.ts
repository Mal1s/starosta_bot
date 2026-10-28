// Shared business logic — duplicated in src/lib/rules.ts for client mock

export type FactStatus = 'present' | 'absent' | 'late' | 'valid' | 'sick';
export type AnswerKind = 'will' | 'wont' | 'late';
export type AbsenceReason = 'valid' | 'dont_want' | 'sick';
export type WeekParity = 'all' | 'odd' | 'even';
export type LessonKind = 'lecture' | 'practice' | 'lab' | 'other';

export interface Slot {
  id: string;
  weekday: number;
  lesson_no: number;
  starts: string;
  ends: string;
  subject: string;
  teacher?: string | null;
  room?: string | null;
  kind: LessonKind;
  parity: WeekParity;
  subgroup_id?: string | null;
  subgroup_name?: string | null;
}

export type EffectiveStatus =
  | 'present' | 'absent' | 'late' | 'valid' | 'sick'
  | 'will' | 'wont_valid' | 'wont_dont_want' | 'late_planned'
  | 'no_data' | 'cancelled';

export function effectiveStatus(
  cell: {
    slot: { cancelled?: boolean };
    actual?: { status: FactStatus } | null;
    absence?: { reason: AbsenceReason } | null;
    recurring?: { reason: AbsenceReason } | null;
    planned?: { answer: AnswerKind; reason?: AbsenceReason | null } | null;
  },
  dayClosed: boolean
): EffectiveStatus {
  if (cell.slot.cancelled) return 'cancelled';
  if (cell.actual) return cell.actual.status;
  if (cell.absence) {
    if (cell.absence.reason === 'sick') return 'sick';
    if (cell.absence.reason === 'valid') return 'valid';
    return 'absent';
  }
  if (cell.recurring) {
    if (cell.recurring.reason === 'sick') return 'sick';
    if (cell.recurring.reason === 'valid') return 'valid';
    return 'absent';
  }
  if (cell.planned) {
    if (cell.planned.answer === 'will') return dayClosed ? 'present' : 'will';
    if (cell.planned.answer === 'late') return dayClosed ? 'late' : 'late_planned';
    if (cell.planned.answer === 'wont') {
      if (cell.planned.reason === 'valid') return 'wont_valid';
      if (cell.planned.reason === 'sick') return 'sick';
      return 'wont_dont_want';
    }
  }
  return 'no_data';
}

export function closeDayMapping(
  planned: { answer: AnswerKind; reason?: AbsenceReason | null } | null,
  absence: { reason: AbsenceReason } | null,
  recurring: { reason: AbsenceReason } | null
): FactStatus | null {
  if (absence) {
    if (absence.reason === 'sick') return 'sick';
    if (absence.reason === 'valid') return 'valid';
    return 'absent';
  }
  if (recurring) {
    if (recurring.reason === 'sick') return 'sick';
    if (recurring.reason === 'valid') return 'valid';
    return 'absent';
  }
  if (planned) {
    if (planned.answer === 'will') return 'present';
    if (planned.answer === 'late') return 'late';
    if (planned.answer === 'wont') {
      if (planned.reason === 'valid') return 'valid';
      if (planned.reason === 'sick') return 'sick';
      return 'absent';
    }
  }
  return null;
}

export function weekParity(date: string, semesterStart: string | null): 'odd' | 'even' | null {
  if (!semesterStart) return null;
  const monday = (d: Date) => {
    const x = new Date(d);
    const wd = (x.getUTCDay() + 6) % 7;
    x.setUTCDate(x.getUTCDate() - wd);
    return x;
  };
  const a = monday(new Date(semesterStart + 'T00:00:00Z'));
  const b = monday(new Date(date + 'T00:00:00Z'));
  const weeks = Math.round((b.getTime() - a.getTime()) / (7 * 86400000));
  return weeks % 2 === 0 ? 'odd' : 'even';
}

export function voteQuorum(activeCount: number): { minVotes: number; quorum: number } {
  const minVotes = activeCount < 6 ? 2 : 3;
  const quorum = Math.max(minVotes, Math.ceil(activeCount / 2));
  return { minVotes, quorum };
}

export function shortCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 2) code += '-';
  }
  return code;
}

export function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3 || i === 7) code += '-';
  }
  return code;
}
