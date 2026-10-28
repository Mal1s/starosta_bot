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

export interface Override {
  id: string;
  date: string;
  slot_id: string;
  action: 'cancel' | 'move' | 'replace';
  new_starts?: string | null;
  new_ends?: string | null;
  new_room?: string | null;
  new_subject?: string | null;
  new_teacher?: string | null;
  note?: string | null;
}

export interface EffectiveCell {
  membership_id: string;
  full_name: string;
  slot_id: string;
  slot: Slot & { cancelled?: boolean };
  actual?: { status: FactStatus; set_by?: string; set_at: string } | null;
  planned?: { answer: AnswerKind; reason?: AbsenceReason | null; comment?: string | null } | null;
  absence?: { reason: AbsenceReason } | null;
  recurring?: { reason: AbsenceReason } | null;
}

export type EffectiveStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'valid'
  | 'sick'
  | 'will'
  | 'wont_valid'
  | 'wont_dont_want'
  | 'late_planned'
  | 'no_data'
  | 'cancelled';

export function effectiveStatus(cell: EffectiveCell, dayClosed: boolean): EffectiveStatus {
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

export interface AttendanceRate {
  rate: number | null;
  rateWithValid: number | null;
}

export function calcRate(
  counts: { present: number; late: number; absent: number; valid: number; sick: number }
): AttendanceRate {
  const ok = counts.present + counts.late;
  const rate = ok + counts.absent === 0 ? null : ok / (ok + counts.absent);
  const denom = ok + counts.valid + counts.absent;
  const rateWithValid = denom === 0 ? null : (ok + counts.valid) / denom;
  return { rate, rateWithValid };
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

export interface VoteQuorum {
  minVotes: number;
  quorum: number;
}

export function voteQuorum(activeCount: number): VoteQuorum {
  const minVotes = activeCount < 6 ? 2 : 3;
  const quorum = Math.max(minVotes, Math.ceil(activeCount / 2));
  return { minVotes, quorum };
}
