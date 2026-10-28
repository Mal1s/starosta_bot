// Edge Function: api — REST API for Starosta Bot Mini App
// All requests require X-Telegram-Init-Data header (verified via HMAC-SHA256)

import { verifyInitData, type TelegramUser } from '../_shared/auth.ts';
import { findOrCreateUser, getUserMembership, getSupabaseClient } from '../_shared/db.ts';
import { shortCode, recoveryCode } from '../_shared/rules.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Telegram-Init-Data',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function authenticate(req: Request): Promise<{ userId: string; telegramUser: TelegramUser } | null> {
  const initData = req.headers.get('X-Telegram-Init-Data');
  if (!initData) return null;
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return null;
  const verified = verifyInitData(initData, botToken);
  if (!verified) return null;
  const user = await findOrCreateUser(verified.user);
  if (!user) return null;
  return { userId: user.id, telegramUser: verified.user };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/+/, '');
    const method = req.method;
    const supabase = getSupabaseClient();

    // Public route: GET /health
    if (path === 'health' || path === '') {
      return jsonResponse({ status: 'ok' });
    }

    // Authenticate all other routes
    const auth = await authenticate(req);
    if (!auth) {
      return errorResponse('UNAUTHORIZED', 'Не удалось проверить подпись Telegram', 401);
    }
    const { userId } = auth;

    // ===== GET /me =====
    if (path === 'me' && method === 'GET') {
      const membership = await getUserMembership(userId);
      const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
      if (!user) return errorResponse('NOT_FOUND', 'Пользователь не найден', 404);

      let group = null;
      let membershipData = null;
      let subgroups: unknown[] = [];
      let unreadAnnouncements = 0;

      if (membership) {
        group = membership.groups;
        membershipData = {
          id: membership.id,
          group_id: membership.group_id,
          user_id: membership.user_id,
          role: membership.role,
          status: membership.status,
          full_name: membership.full_name,
          joined_at: membership.joined_at,
          left_at: membership.left_at,
        };
        const { data: subs } = await supabase
          .from('subgroups')
          .select('*')
          .eq('group_id', membership.group_id);
        subgroups = subs ?? [];

        const { data: memberSubs } = await supabase
          .from('member_subgroups')
          .select('subgroup_id')
          .eq('membership_id', membership.id);
        const subIds = (memberSubs ?? []).map((s: { subgroup_id: string }) => s.subgroup_id);

        const { count } = await supabase
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', membership.group_id)
          .gt('published_at', new Date(0).toISOString());

        if (count && count > 0) {
          const { data: anns } = await supabase
            .from('announcements')
            .select('id')
            .eq('group_id', membership.group_id)
            .not('published_at', 'is', null);
          const annIds = (anns ?? []).map((a: { id: string }) => a.id);
          if (annIds.length > 0) {
            const { data: reads } = await supabase
              .from('announcement_reads')
              .select('announcement_id')
              .eq('membership_id', membership.id);
            const readIds = new Set((reads ?? []).map((r: { announcement_id: string }) => r.announcement_id));
            unreadAnnouncements = annIds.filter((id: string) => !readIds.has(id)).length;
          }
        }
      }

      return jsonResponse({
        user,
        membership: membershipData,
        group,
        subgroups,
        unread_announcements: unreadAnnouncements,
        onboarding: group ? { shared: true, schedule: true, journal: false } : { shared: false, schedule: false, journal: false },
      });
    }

    // ===== POST /groups (create group) =====
    if (path === 'groups' && method === 'POST') {
      const body = await req.json();
      if (!body.name || !body.full_name) {
        return errorResponse('VALIDATION', 'Название группы и ФИО обязательны');
      }

      // Check user doesn't already have a group
      const existing = await getUserMembership(userId);
      if (existing && existing.status === 'active') {
        return errorResponse('ALREADY_IN_GROUP', 'Вы уже состоите в группе');
      }

      const token = crypto.randomUUID().replace(/-/g, '');
      const code = shortCode();
      const recCode = recoveryCode();

      // Hash recovery code
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(recCode));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: group, error } = await supabase
        .from('groups')
        .insert({
          name: body.name,
          institution: body.institution ?? null,
          course: body.course ?? null,
          timezone: body.timezone ?? 'Europe/Moscow',
          invite_token: token,
          short_code: code,
          recovery_code_hash: hashHex,
        })
        .select('*')
        .single();

      if (error || !group) {
        return errorResponse('DB_ERROR', 'Не удалось создать группу', 500);
      }

      // Create membership as headman
      const { data: membership } = await supabase
        .from('memberships')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'headman',
          status: 'active',
          full_name: body.full_name,
        })
        .select('*')
        .single();

      return jsonResponse({
        group,
        invite: { link: `https://t.me/${Deno.env.get('BOT_USERNAME') ?? 'bot'}?startapp=${token}`, code },
        recovery_code: recCode,
      });
    }

    // ===== POST /groups/join =====
    if (path === 'groups/join' && method === 'POST') {
      const body = await req.json();
      if (!body.code || !body.full_name || !body.consent) {
        return errorResponse('VALIDATION', 'Код, ФИО и согласие обязательны');
      }

      const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('short_code', body.code.toUpperCase())
        .maybeSingle();

      if (!group) {
        return errorResponse('NOT_FOUND', 'Группа не найдена');
      }

      // Check member limit
      const { count } = await supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', group.id)
        .eq('status', 'active');
      if (count && count >= group.member_limit) {
        return errorResponse('GROUP_FULL', 'Группа заполнена');
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('memberships')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'removed') {
          return errorResponse('REMOVED', 'Вас удалили из группы. Подайте новую заявку.');
        }
        // Reactivate
        await supabase
          .from('memberships')
          .update({ status: 'active', full_name: body.full_name })
          .eq('id', existing.id);
        return jsonResponse(existing);
      }

      const status = group.join_mode === 'auto' ? 'active' : 'pending';
      const { data: membership, error } = await supabase
        .from('memberships')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'student',
          status,
          full_name: body.full_name,
        })
        .select('*')
        .single();

      if (error || !membership) {
        return errorResponse('DB_ERROR', 'Не удалось присоединиться', 500);
      }

      return jsonResponse(membership);
    }

    // ===== GET /schedule?from=&to= =====
    if (path === 'schedule' && method === 'GET') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;

      const { data: slots } = await supabase
        .from('schedule_slots')
        .select('*')
        .eq('group_id', membership.group_id);

      const { data: memberSubs } = await supabase
        .from('member_subgroups')
        .select('subgroup_id')
        .eq('membership_id', membership.id);
      const subIds = (memberSubs ?? []).map((s: { subgroup_id: string }) => s.subgroup_id);

      const days: unknown[] = [];
      let d = new Date(from + 'T00:00:00Z');
      const end = new Date(to + 'T00:00:00Z');
      while (d <= end) {
        const dateStr = d.toISOString().slice(0, 10);
        const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
        const daySlots = (slots ?? []).filter((s: { weekday: number; subgroup_id: string | null; parity: string }) =>
          s.weekday === weekday &&
          (s.subgroup_id === null || subIds.includes(s.subgroup_id)) &&
          s.parity === 'all'
        );
        if (daySlots.length > 0) {
          days.push({ date: dateStr, slots: daySlots });
        }
        d.setUTCDate(d.getUTCDate() + 1);
      }

      return jsonResponse(days);
    }

    // ===== GET /announcements =====
    if (path === 'announcements' && method === 'GET') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const { data: anns } = await supabase
        .from('announcements')
        .select('*')
        .eq('group_id', membership.group_id)
        .not('published_at', 'is', null)
        .order('created_at', { ascending: false });

      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('membership_id', membership.id);
      const readIds = new Set((reads ?? []).map((r: { announcement_id: string }) => r.announcement_id));

      const result = (anns ?? []).map((a: Record<string, unknown>) => ({
        ...a,
        unread: !readIds.has(a.id as string),
      }));

      return jsonResponse(result);
    }

    // ===== POST /announcements/:id/read =====
    const readMatch = path.match(/^announcements\/([^/]+)\/read$/);
    if (readMatch && method === 'POST') {
      const annId = readMatch[1];
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      await supabase
        .from('announcement_reads')
        .upsert({ announcement_id: annId, membership_id: membership.id });

      return jsonResponse(null);
    }

    // ===== POST /announcements/read-all =====
    if (path === 'announcements/read-all' && method === 'POST') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const { data: anns } = await supabase
        .from('announcements')
        .select('id')
        .eq('group_id', membership.group_id)
        .not('published_at', 'is', null);

      for (const a of anns ?? []) {
        await supabase
          .from('announcement_reads')
          .upsert({ announcement_id: (a as { id: string }).id, membership_id: membership.id });
      }

      return jsonResponse(null);
    }

    // ===== GET /members =====
    if (path === 'members' && method === 'GET') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const { data: members } = await supabase
        .from('memberships')
        .select('*')
        .eq('group_id', membership.group_id)
        .in('status', ['active', 'pending'])
        .order('full_name');

      return jsonResponse(members);
    }

    // ===== GET /journal?date= =====
    if (path === 'journal' && method === 'GET') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

      const { data: slots } = await supabase
        .from('schedule_slots')
        .select('*')
        .eq('group_id', membership.group_id);

      const { data: members } = await supabase
        .from('memberships')
        .select('*')
        .eq('group_id', membership.group_id)
        .eq('status', 'active');

      const { data: planned } = await supabase
        .from('planned_attendance')
        .select('*')
        .eq('date', date);

      const { data: actual } = await supabase
        .from('actual_attendance')
        .select('*')
        .eq('date', date);

      const { data: dayState } = await supabase
        .from('day_state')
        .select('*')
        .eq('group_id', membership.group_id)
        .eq('date', date)
        .maybeSingle();

      const plannedMap = new Map((planned ?? []).map((p: { membership_id: string; slot_id: string }) => [`${p.membership_id}:${p.slot_id}`, p]));
      const actualMap = new Map((actual ?? []).map((a: { membership_id: string; slot_id: string }) => [`${a.membership_id}:${a.slot_id}`, a]));

      const rows = (members ?? []).map((m: { id: string; full_name: string }) => ({
        membership_id: m.id,
        full_name: m.full_name,
        cells: (slots ?? []).map((slot: { id: string; subgroup_id: string | null }) => {
          const key = `${m.id}:${slot.id}`;
          const a = actualMap.get(key) as { status: string } | undefined;
          const p = plannedMap.get(key) as { status: string } | undefined;
          let status = 'no_data';
          if (a) status = a.status;
          else if (p) status = (p as { answer: string }).answer === 'will' ? 'will' : (p as { answer: string }).answer === 'late' ? 'late_planned' : 'wont_dont_want';
          return { slot_id: slot.id, status, confirmed: !!a };
        }),
      }));

      return jsonResponse({ date, closed: dayState?.closed ?? false, rows, slots: slots ?? [] });
    }

    // ===== GET /stats?from=&to= =====
    if (path === 'stats' && method === 'GET') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const from = url.searchParams.get('from') ?? '2026-01-01';
      const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);

      const { data: actual } = await supabase
        .from('actual_attendance')
        .select('status')
        .gte('date', from)
        .lte('date', to);

      const counts: Record<string, number> = {
        present: 0, late: 0, absent: 0, valid: 0, sick: 0, no_data: 0, cancelled: 0,
      };
      for (const a of actual ?? []) {
        const s = (a as { status: string }).status;
        if (counts[s] !== undefined) counts[s]++;
      }
      const total = counts.present + counts.late + counts.absent;
      const rate = total === 0 ? null : (counts.present + counts.late) / total;

      return jsonResponse({
        total_slots: Object.values(counts).reduce((a, b) => a + b, 0),
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        valid: counts.valid,
        sick: counts.sick,
        no_data: counts.no_data,
        cancelled: counts.cancelled,
        rate,
        rate_with_valid: null,
      });
    }

    // ===== GET /stats/me =====
    if (path === 'stats/me' && method === 'GET') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const { data: actual } = await supabase
        .from('actual_attendance')
        .select('status')
        .eq('membership_id', membership.id);

      let visited = 0, missed = 0, sick = 0, valid = 0;
      for (const a of actual ?? []) {
        const s = (a as { status: string }).status;
        if (s === 'present' || s === 'late') visited++;
        else if (s === 'absent') missed++;
        else if (s === 'sick') sick++;
        else if (s === 'valid') valid++;
      }
      const total = visited + missed;
      const rate = total === 0 ? null : visited / total;

      return jsonResponse({ visited, missed, sick, valid, rate });
    }

    // ===== GET /groups/invite =====
    if (path === 'groups/invite' && method === 'GET') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);

      const { data: group } = await supabase
        .from('groups')
        .select('invite_token, short_code')
        .eq('id', membership.group_id)
        .single();

      return jsonResponse({
        link: `https://t.me/${Deno.env.get('BOT_USERNAME') ?? 'bot'}?startapp=${group?.invite_token ?? ''}`,
        code: group?.short_code ?? '',
      });
    }

    // ===== PUT /me/settings =====
    if (path === 'me/settings' && method === 'PUT') {
      const body = await req.json();
      const update: Record<string, unknown> = {};
      if (body.theme !== undefined) update.theme = body.theme;
      if (body.background !== undefined) update.background = body.background;
      if (body.reduce_motion !== undefined) update.reduce_motion = body.reduce_motion;
      if (body.lesson_reminder_minutes !== undefined) update.lesson_reminder_minutes = body.lesson_reminder_minutes;
      if (body.timezone !== undefined) update.timezone = body.timezone;

      await supabase.from('users').update(update).eq('id', userId);
      return jsonResponse(null);
    }

    // ===== POST /members/:id/approve =====
    const approveMatch = path.match(/^members\/([^/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);
      if (membership.role !== 'headman' && membership.role !== 'deputy') {
        return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      }
      await supabase
        .from('memberships')
        .update({ status: 'active' })
        .eq('id', approveMatch[1]);
      return jsonResponse(null);
    }

    // ===== POST /members/:id/reject =====
    const rejectMatch = path.match(/^members\/([^/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);
      if (membership.role !== 'headman' && membership.role !== 'deputy') {
        return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      }
      await supabase
        .from('memberships')
        .update({ status: 'removed' })
        .eq('id', rejectMatch[1]);
      return jsonResponse(null);
    }

    // ===== POST /attendance/close-day =====
    if (path === 'attendance/close-day' && method === 'POST') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);
      if (membership.role !== 'headman' && membership.role !== 'deputy') {
        return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      }
      const body = await req.json();
      await supabase
        .from('day_state')
        .upsert({
          group_id: membership.group_id,
          date: body.date,
          closed: true,
          closed_at: new Date().toISOString(),
          closed_by: userId,
        });
      return jsonResponse(null);
    }

    // ===== PUT /attendance =====
    if (path === 'attendance' && method === 'PUT') {
      const membership = await getUserMembership(userId);
      if (!membership) return errorResponse('NO_GROUP', 'Нет группы', 403);
      if (membership.role !== 'headman' && membership.role !== 'deputy') {
        return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      }
      const body = await req.json();
      await supabase
        .from('actual_attendance')
        .upsert({
          membership_id: body.membership_id,
          date: body.date,
          slot_id: body.slot_id,
          status: body.status,
          set_by: userId,
        });
      return jsonResponse(null);
    }

    return errorResponse('NOT_FOUND', `Маршрут не найден: ${method} ${path}`, 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse('INTERNAL', msg, 500);
  }
});
