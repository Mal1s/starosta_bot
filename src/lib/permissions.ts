export type Role = 'student' | 'deputy' | 'headman' | 'admin';

export function isStaff(role: Role): boolean {
  return role === 'deputy' || role === 'headman';
}

export function isHeadman(role: Role): boolean {
  return role === 'headman';
}

export function isAdmin(role: Role): boolean {
  return role === 'admin';
}

export function canEditSchedule(role: Role, deputyCanEditSchedule: boolean): boolean {
  return role === 'headman' || (role === 'deputy' && deputyCanEditSchedule);
}

export function canAnnounce(role: Role, deputyCanAnnounce: boolean): boolean {
  return role === 'headman' || (role === 'deputy' && deputyCanAnnounce);
}

export function canSeeReasons(role: Role, deputyCanSeeReasons: boolean): boolean {
  return role === 'headman' || (role === 'deputy' && deputyCanSeeReasons);
}

export function canManageGroup(role: Role): boolean {
  return role === 'headman';
}

export function canManageMembers(role: Role): boolean {
  return isStaff(role);
}

export function canEditJournal(role: Role): boolean {
  return isStaff(role);
}

export function canChangeSettings(role: Role): boolean {
  return role === 'headman';
}
