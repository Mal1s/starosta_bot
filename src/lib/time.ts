import { format, parseISO } from 'date-fns';
import { ru as ruDateLocale } from 'date-fns/locale';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export function formatDate(date: Date | string, pattern: string, timeZone?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const zoned = timeZone ? toZonedTime(d, timeZone) : d;
  return format(zoned, pattern, { locale: ruDateLocale });
}

export function todayISO(timeZone?: string): string {
  const now = new Date();
  const zoned = timeZone ? toZonedTime(now, timeZone) : now;
  return format(zoned, 'yyyy-MM-dd');
}

export function localNow(timeZone?: string): Date {
  return timeZone ? toZonedTime(new Date(), timeZone) : new Date();
}

export function toUTC(date: Date, timeZone: string): Date {
  return fromZonedTime(date, timeZone);
}

export function isoWeekday(date: Date): number {
  const wd = date.getDay();
  return wd === 0 ? 7 : wd;
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
