// Edge Function: scheduler-tick — Cron-based scheduler
// Triggered by Supabase Scheduled Triggers (or external cron).
// Handles: evening polls, morning reminders, announcement delivery,
// sick checks, weekly reports.

import { getSupabaseClient } from '../_shared/db.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { effectiveStatus, closeDayMapping, weekParity } from '../_shared/rules.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface LessonSlot {
  id: string;
  weekday: number;
  lesson_no: number;
  starts: string;
  ends: string;
  subject: string;
  teacher: string | null;
  room: string | null;
  kind: string;
  parity: string;
  subgroup_id: string | null;
}

interface Membership {
  id: string;
  user_id: string;
  group_id: string;
  role: string;
  status: string;
  full_name: string;
  users: { telegram_id: number };
}

interface Group {
  id: string;
  name: string;
  timezone: string;
  poll_mode: string;
  evening_time: string;
  morning_offset_min: number;
  summary_offset_min: number;
  quiet_from: string;
  quiet_to: string;
  work_days: number[];
  semester_start: string | null;
}

function isQuietTime(group: Group): boolean {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: group.timezone }));
  const hhmm = tzNow.toTimeString().slice(0, 5);
  const quietFrom = group.quiet_from;
  const quietTo = group.quiet_to;
  if (quietFrom <= quietTo) {
    return hhmm >= quietFrom && hhmm < quietTo;
  }
  return hhmm >= quietFrom || hhmm < quietTo;
}

function tomorrowDateString(group: Group): string {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: group.timezone }));
  tzNow.setDate(tzNow.getDate() + 1);
  return tzNow.toISOString().slice(0, 10);
}

function todayDateString(group: Group): string {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: group.timezone }));
  return tzNow.toISOString().slice(0, 10);
}

function todayWeekday(group: Group): number {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: group.timezone }));
  const wd = tzNow.getDay();
  return wd === 0 ? 7 : wd;
}

function tomorrowWeekday(group: Group): number {
  const wd = todayWeekday(group);
  return wd === 7 ? 1 : wd + 1;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify CRON_SECRET if set
  if (CRON_SECRET) {
    const authHeader = req.headers.get('Authorization');
    const providedSecret = authHeader?.replace('Bearer ', '') ?? '';
    if (providedSecret !== CRON_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }
  }

  try {
    const supabase = getSupabaseClient();
    const results: Record<string, number> = {
      evening_polls: 0,
      morning_reminders: 0,
      deliveries: 0,
      sick_checks: 0,
      weekly_reports: 0,
      day_closes: 0,
    };

    // Get all active groups
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .eq('state', 'active') as { data: Group[] | null };

    if (!groups || groups.length === 0) {
      return jsonResponse({ ok: true, results });
    }

    for (const group of groups) {
      // Skip if quiet time
      if (isQuietTime(group)) continue;

      const today = todayDateString(group);
      const tomorrow = tomorrowDateString(group);
      const todayWd = todayWeekday(group);
      const tomorrowWd = tomorrowWeekday(group);

      // Check if today is a work day
      const isWorkDay = group.work_days.includes(todayWd);
      const isTomorrowWorkDay = group.work_days.includes(tomorrowWd);

      // Check holidays
      const { data: todayHoliday } = await supabase
        .from('holidays')
        .select('id')
        .eq('group_id', group.id)
        .eq('date', today)
        .maybeSingle();

      const { data: tomorrowHoliday } = await supabase
        .from('holidays')
        .select('id')
        .eq('group_id', group.id)
        .eq('date', tomorrow)
        .maybeSingle();

      const now = new Date();
      const tzNow = new Date(now.toLocaleString('en-US', { timeZone: group.timezone }));
      const hhmm = tzNow.toTimeString().slice(0, 5);

      // === EVENING POLL ===
      // Trigger at group.evening_time if tomorrow is a work day, not a holiday, and poll_mode includes evening
      if (group.poll_mode === 'evening_morning' || group.poll_mode === 'evening_only') {
        if (hhmm >= group.evening_time && isTomorrowWorkDay && !tomorrowHoliday) {
          const dedupeKey = `evening_poll_${group.id}_${tomorrow}`;

          // Check if already sent
          const { data: existing } = await supabase
            .from('deliveries')
            .select('id')
            .eq('dedupe_key', dedupeKey)
            .maybeSingle();

          if (!existing) {
            // Get tomorrow's slots
            const parity = weekParity(tomorrow, group.semester_start);
            const { data: slots } = await supabase
              .from('schedule_slots')
              .select('*')
              .eq('group_id', group.id)
              .eq('weekday', tomorrowWd) as { data: LessonSlot[] | null };

            const daySlots = (slots ?? []).filter(s =>
              s.parity === 'all' || (parity && s.parity === parity)
            );

            if (daySlots.length > 0) {
              // Get active members
              const { data: members } = await supabase
                .from('memberships')
                .select('id, user_id, group_id, role, status, full_name, users!inner(telegram_id)')
                .eq('group_id', group.id)
                .eq('status', 'active') as { data: Membership[] | null };

              for (const member of members ?? []) {
                // Check recurring absences
                const { data: recurring } = await supabase
                  .from('recurring_absences')
                  .select('reason, lesson_nos')
                  .eq('membership_id', member.id)
                  .eq('weekday', tomorrowWd)
                  .maybeSingle();

                // Check one-time absences
                const { data: absence } = await supabase
                  .from('absences')
                  .select('reason')
                  .eq('membership_id', member.id)
                  .lte('date_from', tomorrow)
                  .or(`date_to.is.null,date_to.gte.${tomorrow}`)
                  .maybeSingle();

                if (!recurring && !absence) {
                  const slotList = daySlots.map(s => `${s.lesson_no}. ${s.subject} (${s.starts})`).join('\n');
                  await sendTelegramMessage(
                    BOT_TOKEN,
                    member.users.telegram_id,
                    `Завтра (${tomorrow}) у вас ${daySlots.length} пар(ы):\n${slotList}\n\nОтметьте планируемое посещение в приложении:`,
                    {
                      replyMarkup: { inline_keyboard: [[{ text: 'Отметить', web_app: { url: APP_URL } }]] },
                    }
                  );
                }
              }

              await supabase.from('deliveries').insert({
                group_id: group.id,
                message_type: 'evening_poll',
                dedupe_key: dedupeKey,
                status: 'sent',
                sent_at: new Date().toISOString(),
              });
              results.evening_polls++;
            }
          }
        }
      }

      // === MORNING REMINDER ===
      // Trigger morning_offset_min before first lesson if today is a work day
      if (group.poll_mode === 'evening_morning' || group.poll_mode === 'morning_only') {
        if (isWorkDay && !todayHoliday) {
          const parity = weekParity(today, group.semester_start);
          const { data: todaySlots } = await supabase
            .from('schedule_slots')
            .select('*')
            .eq('group_id', group.id)
            .eq('weekday', todayWd) as { data: LessonSlot[] | null };

          const daySlots = (todaySlots ?? []).filter(s =>
            s.parity === 'all' || (parity && s.parity === parity)
          );

          if (daySlots.length > 0) {
            daySlots.sort((a, b) => a.starts.localeCompare(b.starts));
            const firstLesson = daySlots[0];
            const [h, m] = firstLesson.starts.split(':').map(Number);
            const reminderTime = `${String(h).padStart(2, '0')}:${String(Math.max(0, m - group.morning_offset_min)).padStart(2, '0')}`;

            if (hhmm >= reminderTime) {
              const dedupeKey = `morning_reminder_${group.id}_${today}`;
              const { data: existing } = await supabase
                .from('deliveries')
                .select('id')
                .eq('dedupe_key', dedupeKey)
                .maybeSingle();

              if (!existing) {
                const { data: members } = await supabase
                  .from('memberships')
                  .select('id, user_id, group_id, role, status, full_name, users!inner(telegram_id)')
                  .eq('group_id', group.id)
                  .eq('status', 'active') as { data: Membership[] | null };

                for (const member of members ?? []) {
                  // Only remind those who haven't answered
                  const { data: planned } = await supabase
                    .from('planned_attendance')
                    .select('id')
                    .eq('membership_id', member.id)
                    .eq('date', today)
                    .maybeSingle();

                  if (!planned) {
                    const slotList = daySlots.map(s => `${s.lesson_no}. ${s.subject} (${s.starts})`).join('\n');
                    await sendTelegramMessage(
                      BOT_TOKEN,
                      member.users.telegram_id,
                      `Доброе утро! Сегодня ${daySlots.length} пар(ы):\n${slotList}\n\nОтметьте посещение:`,
                      {
                        replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
                      }
                    );
                  }
                }

                await supabase.from('deliveries').insert({
                  group_id: group.id,
                  message_type: 'morning_reminder',
                  dedupe_key: dedupeKey,
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                });
                results.morning_reminders++;
              }
            }
          }
        }
      }

      // === ANNOUNCEMENT DELIVERY ===
      // Send pending announcements whose send_at has passed
      const { data: pendingAnns } = await supabase
        .from('announcements')
        .select('*')
        .eq('group_id', group.id)
        .is('published_at', null)
        .lte('send_at', new Date().toISOString());

      for (const ann of pendingAnns ?? []) {
        const { data: members } = await supabase
          .from('memberships')
          .select('id, user_id, status, full_name, users!inner(telegram_id)')
          .eq('group_id', group.id)
          .eq('status', 'active') as { data: Membership[] | null };

        const urgentPrefix = ann.urgent ? '⚠️ СРОЧНО\n' : '';
        const msg = `${urgentPrefix}📋 ${ann.title}\n\n${ann.body}`;

        for (const member of members ?? []) {
          const dedupeKey = `ann_${ann.id}_${member.id}`;
          const { data: existing } = await supabase
            .from('deliveries')
            .select('id')
            .eq('dedupe_key', dedupeKey)
            .maybeSingle();

          if (!existing) {
            await sendTelegramMessage(BOT_TOKEN, member.users.telegram_id, msg, {
              replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
            });
            await supabase.from('deliveries').insert({
              group_id: group.id,
              membership_id: member.id,
              message_type: 'announcement',
              dedupe_key: dedupeKey,
              status: 'sent',
              sent_at: new Date().toISOString(),
              payload: { announcement_id: ann.id },
            });
            results.deliveries++;
          }
        }

        // Mark as published
        await supabase.from('announcements').update({ published_at: new Date().toISOString() }).eq('id', ann.id);
      }

      // === SICK CHECK ===
      // If a member marked "sick" absence, send a follow-up after 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().slice(0, 10);

      const { data: sickAbsences } = await supabase
        .from('absences')
        .select('id, membership_id, date_from')
        .eq('reason', 'sick')
        .eq('date_from', threeDaysAgoStr);

      for (const absence of sickAbsences ?? []) {
        const dedupeKey = `sick_check_${absence.id}`;
        const { data: existing } = await supabase
          .from('deliveries')
          .select('id')
          .eq('dedupe_key', dedupeKey)
          .maybeSingle();

        if (!existing) {
          const { data: member } = await supabase
            .from('memberships')
            .select('id, full_name, users!inner(telegram_id)')
            .eq('id', absence.membership_id)
            .maybeSingle() as { data: Membership | null };

          if (member) {
            await sendTelegramMessage(
              BOT_TOKEN,
              member.users.telegram_id,
              'Как ваше самочувствие? Вы на больничном уже 3 дня. Обновите статус, если выздоровели:',
              {
                replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
              }
            );
            await supabase.from('deliveries').insert({
              group_id: group.id,
              membership_id: member.id,
              message_type: 'sick_check',
              dedupe_key: dedupeKey,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
            results.sick_checks++;
          }
        }
      }

      // === AUTO CLOSE DAY ===
      // If day_state not closed and it's past the last lesson end + summary_offset_min
      if (isWorkDay && !todayHoliday) {
        const { data: dayState } = await supabase
          .from('day_state')
          .select('id, closed')
          .eq('group_id', group.id)
          .eq('date', today)
          .maybeSingle();

        if (!dayState || !dayState.closed) {
          const parity = weekParity(today, group.semester_start);
          const { data: todaySlots } = await supabase
            .from('schedule_slots')
            .select('*')
            .eq('group_id', group.id)
            .eq('weekday', todayWd) as { data: LessonSlot[] | null };

          const daySlots = (todaySlots ?? []).filter(s =>
            s.parity === 'all' || (parity && s.parity === parity)
          );

          if (daySlots.length > 0) {
            daySlots.sort((a, b) => b.ends.localeCompare(a.ends));
            const lastLessonEnd = daySlots[0].ends;
            const [h, m] = lastLessonEnd.split(':').map(Number);
            const closeTime = `${String(h).padStart(2, '0')}:${String(Math.min(59, m + group.summary_offset_min)).padStart(2, '0')}`;

            if (hhmm >= closeTime) {
              // Auto-close the day: convert planned to actual
              const { data: members } = await supabase
                .from('memberships')
                .select('id, user_id, group_id, status, full_name, users!inner(telegram_id)')
                .eq('group_id', group.id)
                .eq('status', 'active') as { data: Membership[] | null };

              for (const member of members ?? []) {
                for (const slot of daySlots) {
                  // Check if actual already exists
                  const { data: actual } = await supabase
                    .from('actual_attendance')
                    .select('id')
                    .eq('membership_id', member.id)
                    .eq('date', today)
                    .eq('slot_id', slot.id)
                    .maybeSingle();

                  if (!actual) {
                    // Get planned
                    const { data: planned } = await supabase
                      .from('planned_attendance')
                      .select('answer, reason')
                      .eq('membership_id', member.id)
                      .eq('date', today)
                      .eq('slot_id', slot.id)
                      .maybeSingle();

                    // Check absence
                    const { data: absence } = await supabase
                      .from('absences')
                      .select('reason')
                      .eq('membership_id', member.id)
                      .lte('date_from', today)
                      .or(`date_to.is.null,date_to.gte.${today}`)
                      .maybeSingle();

                    // Check recurring
                    const { data: recurring } = await supabase
                      .from('recurring_absences')
                      .select('reason, lesson_nos')
                      .eq('membership_id', member.id)
                      .eq('weekday', todayWd)
                      .maybeSingle();

                    const hasRecurringForSlot = recurring && Array.isArray(recurring.lesson_nos) && recurring.lesson_nos.includes(slot.lesson_no);

                    const factStatus = closeDayMapping(
                      planned as { answer: string; reason: string | null } | null,
                      absence as { reason: string } | null,
                      hasRecurringForSlot ? recurring as { reason: string } : null
                    );

                    if (factStatus) {
                      await supabase.from('actual_attendance').insert({
                        membership_id: member.id,
                        date: today,
                        slot_id: slot.id,
                        status: factStatus,
                        set_by: null,
                      });
                    }
                  }
                }
              }

              // Mark day as closed
              if (dayState) {
                await supabase.from('day_state').update({ closed: true, closed_at: new Date().toISOString() }).eq('id', dayState.id);
              } else {
                await supabase.from('day_state').insert({
                  group_id: group.id,
                  date: today,
                  closed: true,
                  closed_at: new Date().toISOString(),
                });
              }

              // Send summary to headman
              const { data: headman } = await supabase
                .from('memberships')
                .select('id, users!inner(telegram_id)')
                .eq('group_id', group.id)
                .eq('role', 'headman')
                .eq('status', 'active')
                .maybeSingle() as { data: Membership | null };

              if (headman) {
                await sendTelegramMessage(
                  BOT_TOKEN,
                  headman.users.telegram_id,
                  `День ${today} автоматически закрыт. Откройте приложение для просмотра итогов:`,
                  {
                    replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
                  }
                );
              }
              results.day_closes++;
            }
          }
        }
      }

      // === WEEKLY REPORT ===
      // On Sundays at 20:00, generate weekly report
      if (todayWeekday(group) === 7 && hhmm >= '20:00') {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const weekStartStr = weekStart.toISOString().slice(0, 10);

        const dedupeKey = `weekly_report_${group.id}_${weekStartStr}`;
        const { data: existingReport } = await supabase
          .from('deliveries')
          .select('id')
          .eq('dedupe_key', dedupeKey)
          .maybeSingle();

        if (!existingReport) {
          const { data: existingWeekly } = await supabase
            .from('weekly_reports')
            .select('id')
            .eq('group_id', group.id)
            .eq('week_start', weekStartStr)
            .maybeSingle();

          if (!existingWeekly) {
            // Compute stats
            const { data: members } = await supabase
              .from('memberships')
              .select('id, full_name')
              .eq('group_id', group.id)
              .eq('status', 'active') as { data: { id: string; full_name: string }[] | null };

            const memberStats: Record<string, { present: number; absent: number; late: number; valid: number; sick: number }> = {};
            for (const m of members ?? []) {
              memberStats[m.id] = { present: 0, absent: 0, late: 0, valid: 0, sick: 0 };
              const { data: actuals } = await supabase
                .from('actual_attendance')
                .select('status')
                .eq('membership_id', m.id)
                .gte('date', weekStartStr)
                .lte('date', today);

              for (const a of actuals ?? []) {
                const s = (a as { status: string }).status;
                if (s in memberStats[m.id]) {
                  (memberStats[m.id] as Record<string, number>)[s]++;
                }
              }
            }

            await supabase.from('weekly_reports').insert({
              group_id: group.id,
              week_start: weekStartStr,
              data: { members: memberStats, total_members: members?.length ?? 0 },
            });

            // Send to headman
            const { data: headman } = await supabase
              .from('memberships')
              .select('users!inner(telegram_id)')
              .eq('group_id', group.id)
              .eq('role', 'headman')
              .eq('status', 'active')
              .maybeSingle() as { data: Membership | null };

            if (headman) {
              await sendTelegramMessage(
                BOT_TOKEN,
                headman.users.telegram_id,
                `📊 Недельный отчёт за ${weekStartStr} – ${today} готов. Откройте приложение для просмотра:`,
                {
                  replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
                }
              );
            }

            await supabase.from('deliveries').insert({
              group_id: group.id,
              message_type: 'weekly_report',
              dedupe_key: dedupeKey,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
            results.weekly_reports++;
          }
        }
      }
    }

    return jsonResponse({ ok: true, results });
  } catch (e) {
    console.error('Scheduler error:', e);
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
