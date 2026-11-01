// Edge Function: api — REST API for Starosta Bot Mini App
// All requests require X-Telegram-Init-Data header (verified via HMAC-SHA256)
// Routes per file 03 §5.2

import { verifyInitData, type TelegramUser } from '../_shared/auth.ts';
import { findOrCreateUser, getUserMembership, getSupabaseClient, hashToken, updateUserActivity, type MembershipWithContext } from '../_shared/db.ts';
import { shortCode, recoveryCode, weekParity, effectiveStatus, closeDayMapping, calcRate, voteQuorum } from '../_shared/rules.ts';

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

interface AuthContext {
  userId: string;
  telegramUser: TelegramUser;
  membership: MembershipWithContext | null;
}

async function authenticate(req: Request): Promise<AuthContext | null> {
  const initData = req.headers.get('X-Telegram-Init-Data');
  if (!initData) return null;
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return null;
  const user = await verifyInitData(initData, botToken);
  if (!user) return null;
  const dbUser = await findOrCreateUser(user);
  if (!dbUser) return null;
  const membership = await getUserMembership(dbUser.id);
  return { userId: dbUser.id, telegramUser: user, membership };
}

function requireRole(auth: AuthContext, roles: string[]): boolean {
  if (!auth.membership) return false;
  return roles.includes(auth.membership.role);
}

function requireStaff(auth: AuthContext): boolean {
  return requireRole(auth, ['deputy', 'headman']);
}

function requireHeadman(auth: AuthContext): boolean {
  return requireRole(auth, ['headman']);
}

async function auditLog(supabase: ReturnType<typeof getSupabaseClient>, groupId: string, actorId: string, action: string, entity: string, entityId: string, diff: unknown): Promise<void> {
  await supabase.from('audit_log').insert({ group_id: groupId, actor_id: actorId, action, entity, entity_id, diff: diff as Record<string, unknown> | null });
}

async function checkRateLimit(supabase: ReturnType<typeof getSupabaseClient>, key: string, limit: number, windowHours: number): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowHours * 3600000)) * (windowHours * 3600000));
  const { data } = await supabase
    .from('rate_limits')
    .select('count')
    .eq('key', key)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle();
  if (data && data.count >= limit) return false;
  if (data) {
    await supabase.from('rate_limits').update({ count: data.count + 1 }).eq('key', key).eq('window_start', windowStart.toISOString());
  } else {
    await supabase.from('rate_limits').insert({ key, window_start: windowStart.toISOString(), count: 1 });
  }
  return true;
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

    // Public: health check
    if (path === 'health' || path === '') {
      return jsonResponse({ status: 'ok' });
    }

    const auth = await authenticate(req);
    if (!auth) {
      return errorResponse('UNAUTHENTICATED', 'Не удалось проверить подпись Telegram', 401);
    }
    const { userId, membership } = auth;

    // Update user activity
    if (membership) await updateUserActivity(membership.id);

    // ===== GET /me =====
    if (path === 'me' && method === 'GET') {
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

        const { data: subs } = await supabase.from('subgroups').select('*').eq('group_id', membership.group_id);
        subgroups = subs ?? [];

        const { data: memberSubs } = await supabase
          .from('membership_subgroups')
          .select('subgroup_id')
          .eq('membership_id', membership.id);
        const subIds = (memberSubs ?? []).map((s: { subgroup_id: string }) => s.subgroup_id);

        // Count unread announcements addressed to this member
        const { data: anns } = await supabase
          .from('announcements')
          .select('id')
          .eq('group_id', membership.group_id)
          .not('published_at', 'is', null)
          .is('deleted_at', null);
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

      const onboarding = group?.onboarding ?? { shared: false, schedule: false, journal: false };

      return jsonResponse({
        user,
        membership: membershipData,
        group,
        subgroups,
        unread_announcements: unreadAnnouncements,
        onboarding,
      });
    }

    // ===== POST /groups (create group) =====
    if (path === 'groups' && method === 'POST') {
      if (membership && membership.status === 'active') {
        return errorResponse('CONFLICT', 'Вы уже состоите в группе');
      }
      const body = await req.json();
      if (!body.name || !body.full_name) {
        return errorResponse('VALIDATION', 'Название группы и ФИО обязательны');
      }

      const token = crypto.randomUUID().replace(/-/g, '');
      const tokenHash = await hashToken(token);
      const code = shortCode();
      const recCode = recoveryCode();
      const recHash = await hashToken(recCode);

      const { data: group, error } = await supabase
        .from('groups')
        .insert({
          name: body.name,
          institution: body.institution ?? null,
          course: body.course ?? null,
          timezone: body.timezone ?? 'Europe/Moscow',
          invite_token_hash: tokenHash,
          short_code: code,
          recovery_hash: recHash,
        })
        .select('*')
        .single();

      if (error || !group) {
        return errorResponse('INTERNAL', 'Не удалось создать группу', 500);
      }

      const { data: newMembership } = await supabase
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

      await auditLog(supabase, group.id, userId, 'group.create', 'group', group.id, null);

      return jsonResponse({
        group,
        invite: { link: `https://t.me/${Deno.env.get('BOT_USERNAME') ?? 'bot'}?startapp=${token}`, code },
        recovery_code: recCode,
      });
    }

    // ===== POST /groups/join =====
    if (path === 'groups/join' && method === 'POST') {
      const body = await req.json();
      if (!body.full_name || !body.consent) {
        return errorResponse('VALIDATION', 'ФИО и согласие обязательны');
      }
      if (!body.token && !body.code) {
        return errorResponse('VALIDATION', 'Нужен код или токен приглашения');
      }

      let group: Record<string, unknown> | null = null;

      if (body.token) {
        const tokenHash = await hashToken(body.token);
        const { data } = await supabase.from('groups').select('*').eq('invite_token_hash', tokenHash).maybeSingle();
        group = data;
      } else if (body.code) {
        const { data } = await supabase.from('groups').select('*').eq('short_code', body.code.toUpperCase()).maybeSingle();
        group = data;
      }

      if (!group) {
        return errorResponse('INVITE_INVALID', 'Группа не найдена');
      }

      // Check invite expiry
      const expiresAt = group.invite_expires_at as string | null;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return errorResponse('INVITE_EXPIRED', 'Срок приглашения истёк');
      }

      // Check member limit
      const { count } = await supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', group.id as string)
        .eq('status', 'active');
      if (count && count >= (group.member_limit as number)) {
        return errorResponse('GROUP_FULL', 'Группа заполнена');
      }

      // Check existing membership
      const { data: existing } = await supabase
        .from('memberships')
        .select('*')
        .eq('group_id', group.id as string)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'removed') {
          return errorResponse('CONFLICT', 'Вас удалили из группы. Подайте новую заявку.');
        }
        // Reactivate
        await supabase.from('memberships').update({ status: 'active', full_name: body.full_name }).eq('id', existing.id);
        return jsonResponse(existing);
      }

      const status = group.join_mode === 'auto' ? 'active' : 'pending';
      const { data: newMembership, error } = await supabase
        .from('memberships')
        .insert({
          group_id: group.id as string,
          user_id: userId,
          role: 'student',
          status,
          full_name: body.full_name,
        })
        .select('*')
        .single();

      if (error || !newMembership) {
        return errorResponse('INTERNAL', 'Не удалось присоединиться', 500);
      }

      // Link roster entry if provided
      if (body.roster_id) {
        await supabase.from('roster').update({ membership_id: newMembership.id }).eq('id', body.roster_id);
      }

      // Link subgroups if provided
      if (body.subgroup_ids && Array.isArray(body.subgroup_ids)) {
        const subRows = body.subgroup_ids.map((sid: string) => ({ membership_id: newMembership.id, subgroup_id: sid }));
        await supabase.from('membership_subgroups').insert(subRows);
      }

      return jsonResponse(newMembership);
    }

    // ===== POST /groups/restore =====
    if (path === 'groups/restore' && method === 'POST') {
      const body = await req.json();
      if (!body.recovery_code) {
        return errorResponse('VALIDATION', 'Код восстановления обязателен');
      }

      const allowed = await checkRateLimit(supabase, `recovery:${userId}`, 5, 1);
      if (!allowed) return errorResponse('RATE_LIMIT', 'Слишком много попыток. Попробуйте через час.');

      const recHash = await hashToken(body.recovery_code);
      const { data: group } = await supabase.from('groups').select('*').eq('recovery_hash', recHash).maybeSingle();
      if (!group) {
        return errorResponse('RECOVERY_INVALID', 'Неверный код восстановления');
      }

      // Check no active headman (or voting in progress)
      const { data: activeHeadman } = await supabase
        .from('memberships')
        .select('id')
        .eq('group_id', group.id)
        .eq('role', 'headman')
        .eq('status', 'active')
        .maybeSingle();
      if (activeHeadman) {
        return errorResponse('CONFLICT', 'У группы уже есть активный староста');
      }

      // Transfer role to this account
      await supabase.from('memberships').upsert({
        group_id: group.id,
        user_id: userId,
        role: 'headman',
        status: 'active',
        full_name: body.full_name ?? auth.telegramUser.first_name ?? 'Староста',
      });

      await supabase.from('leadership_events').insert({
        group_id: group.id,
        type: 'recovered',
        target_id: userId,
      });

      const { data: newMembership } = await supabase
        .from('memberships')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .single();

      return jsonResponse(newMembership);
    }

    // ===== GET /groups/invite =====
    if (path === 'groups/invite' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);

      const { data: group } = await supabase
        .from('groups')
        .select('invite_token_hash, short_code')
        .eq('id', membership.group_id)
        .single();

      // We return the hash as the token (client can't use it directly, but link uses original token)
      return jsonResponse({
        link: `https://t.me/${Deno.env.get('BOT_USERNAME') ?? 'bot'}?startapp=${group?.invite_token_hash ?? ''}`,
        code: group?.short_code ?? '',
      });
    }

    // ===== POST /groups/invite/regenerate =====
    if (path === 'groups/invite/regenerate' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);

      const token = crypto.randomUUID().replace(/-/g, '');
      const tokenHash = await hashToken(token);
      const code = shortCode();
      await supabase.from('groups').update({ invite_token_hash: tokenHash, short_code: code }).eq('id', membership.group_id);
      await auditLog(supabase, membership.group_id, userId, 'settings.update', 'group', membership.group_id, { invite: 'regenerated' });

      return jsonResponse({
        link: `https://t.me/${Deno.env.get('BOT_USERNAME') ?? 'bot'}?startapp=${token}`,
        code,
      });
    }

    // ===== POST /groups/recovery/regenerate =====
    if (path === 'groups/recovery/regenerate' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);

      const recCode = recoveryCode();
      const recHash = await hashToken(recCode);
      await supabase.from('groups').update({ recovery_hash: recHash }).eq('id', membership.group_id);
      await auditLog(supabase, membership.group_id, userId, 'settings.update', 'group', membership.group_id, { recovery: 'regenerated' });

      return jsonResponse({ recovery_code: recCode });
    }

    // ===== GET /groups/settings =====
    if (path === 'groups/settings' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: group } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
      // Strip secrets for non-headman
      if (!requireHeadman(auth)) {
        const { recovery_hash: _rh, invite_token_hash: _ith, ...safe } = group ?? {};
        return jsonResponse(safe);
      }
      return jsonResponse(group);
    }

    // ===== PUT /groups/settings =====
    if (path === 'groups/settings' && method === 'PUT') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);

      const body = await req.json();
      const allowed = ['timezone', 'poll_mode', 'evening_time', 'morning_offset_min', 'summary_offset_min',
        'quiet_from', 'quiet_to', 'work_days', 'semester_start', 'semester_end', 'absence_warn_threshold',
        'show_group_counts_to_students', 'deputy_can_edit_schedule', 'deputy_can_announce',
        'deputy_can_see_reasons', 'theme', 'background', 'join_mode', 'member_limit', 'invite_expires_at',
        'onboarding'];
      const update: Record<string, unknown> = {};
      for (const key of allowed) {
        if (body[key] !== undefined) update[key] = body[key];
      }

      const { data: before } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
      await supabase.from('groups').update(update).eq('id', membership.group_id);
      const { data: after } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
      await auditLog(supabase, membership.group_id, userId, 'settings.update', 'group', membership.group_id, { before, after });

      return jsonResponse(after);
    }

    // ===== DELETE /groups =====
    if (path === 'groups' && method === 'DELETE') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);

      const deleteAfter = new Date(Date.now() + 7 * 86400000).toISOString();
      await supabase.from('groups').update({ state: 'pending_deletion', delete_after: deleteAfter }).eq('id', membership.group_id);
      await auditLog(supabase, membership.group_id, userId, 'group.delete', 'group', membership.group_id, null);

      return jsonResponse({ delete_after: deleteAfter });
    }

    // ===== POST /groups/restore-deletion =====
    if (path === 'groups/restore-deletion' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);

      await supabase.from('groups').update({ state: 'active', delete_after: null }).eq('id', membership.group_id);
      await auditLog(supabase, membership.group_id, userId, 'group.restore_deletion', 'group', membership.group_id, null);

      return jsonResponse(null);
    }

    // ===== GET /members =====
    if (path === 'members' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);

      const { data: members } = await supabase
        .from('memberships')
        .select('*, users!inner(telegram_id, bot_blocked)')
        .eq('group_id', membership.group_id)
        .in('status', ['active', 'pending'])
        .order('full_name');

      return jsonResponse(members);
    }

    // ===== POST /members/:id/approve =====
    const approveMatch = path.match(/^members\/([^/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      await supabase.from('memberships').update({ status: 'active' }).eq('id', approveMatch[1]);
      await auditLog(supabase, membership.group_id, userId, 'member.approve', 'membership', approveMatch[1], null);
      return jsonResponse(null);
    }

    // ===== POST /members/:id/reject =====
    const rejectMatch = path.match(/^members\/([^/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      await supabase.from('memberships').update({ status: 'removed' }).eq('id', rejectMatch[1]);
      await auditLog(supabase, membership.group_id, userId, 'member.reject', 'membership', rejectMatch[1], null);
      return jsonResponse(null);
    }

    // ===== POST /members/:id/remove =====
    const removeMatch = path.match(/^members\/([^/]+)\/remove$/);
    if (removeMatch && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      await supabase.from('memberships').update({ status: 'removed', left_at: new Date().toISOString() }).eq('id', removeMatch[1]);
      await auditLog(supabase, membership.group_id, userId, 'member.remove', 'membership', removeMatch[1], null);
      return jsonResponse(null);
    }

    // ===== PUT /members/:id/subgroups =====
    const subgroupsMatch = path.match(/^members\/([^/]+)\/subgroups$/);
    if (subgroupsMatch && method === 'PUT') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      const memId = subgroupsMatch[1];
      await supabase.from('membership_subgroups').delete().eq('membership_id', memId);
      if (body.subgroup_ids?.length) {
        const rows = body.subgroup_ids.map((sid: string) => ({ membership_id: memId, subgroup_id: sid }));
        await supabase.from('membership_subgroups').insert(rows);
      }
      await auditLog(supabase, membership.group_id, userId, 'member.subgroups', 'membership', memId, body.subgroup_ids);
      return jsonResponse(null);
    }

    // ===== PUT /members/:id/role =====
    const roleMatch = path.match(/^members\/([^/]+)\/role$/);
    if (roleMatch && method === 'PUT') {
      if (!membership || !requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);
      const body = await req.json();
      const memId = roleMatch[1];

      // Check deputy limit (max 2)
      if (body.role === 'deputy') {
        const { count } = await supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', membership.group_id)
          .eq('role', 'deputy')
          .eq('status', 'active');
        if (count && count >= 2) {
          return errorResponse('CONFLICT', 'Максимум 2 заместителя');
        }
      }

      await supabase.from('memberships').update({ role: body.role }).eq('id', memId);
      await auditLog(supabase, membership.group_id, userId, 'member.role', 'membership', memId, { role: body.role });
      return jsonResponse(null);
    }

    // ===== GET/POST/DELETE /roster =====
    if (path === 'roster' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const { data: roster } = await supabase.from('roster').select('*').eq('group_id', membership.group_id).order('full_name');
      return jsonResponse(roster);
    }

    if (path === 'roster' && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      const names: string[] = body.names ?? [];
      if (!names.length) return errorResponse('VALIDATION', 'Список пуст');
      const rows = names.map((n: string) => ({ group_id: membership.group_id, full_name: n.trim() }).trim ? { group_id: membership.group_id, full_name: n.trim() } : { group_id: membership.group_id, full_name: n });
      await supabase.from('roster').insert(rows);
      return jsonResponse(null);
    }

    const rosterDeleteMatch = path.match(/^roster\/([^/]+)$/);
    if (rosterDeleteMatch && method === 'DELETE') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      await supabase.from('roster').delete().eq('id', rosterDeleteMatch[1]);
      return jsonResponse(null);
    }

    // ===== GET/POST/DELETE /subgroups =====
    if (path === 'subgroups' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: subs } = await supabase.from('subgroups').select('*').eq('group_id', membership.group_id);
      return jsonResponse(subs);
    }

    if (path === 'subgroups' && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      const { data: sub } = await supabase
        .from('subgroups')
        .insert({ group_id: membership.group_id, name: body.name })
        .select('*')
        .single();
      return jsonResponse(sub);
    }

    const subgroupDeleteMatch = path.match(/^subgroups\/([^/]+)$/);
    if (subgroupDeleteMatch && method === 'DELETE') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      await supabase.from('subgroups').delete().eq('id', subgroupDeleteMatch[1]);
      return jsonResponse(null);
    }

    // ===== POST /leave =====
    if (path === 'leave' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const body = await req.json().catch(() => ({}));

      if (membership.role === 'headman') {
        if (!body.successor_id) {
          return errorResponse('VALIDATION', 'Укажите преемника перед выходом');
        }
        // Transfer headman role to successor
        await supabase.from('memberships').update({ role: 'headman' }).eq('id', body.successor_id);
      }

      await supabase.from('memberships').update({ status: 'left', left_at: new Date().toISOString() }).eq('id', membership.id);
      await auditLog(supabase, membership.group_id, userId, 'member.leave', 'membership', membership.id, null);
      return jsonResponse(null);
    }

    // ===== GET /my-data =====
    if (path === 'my-data' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: planned } = await supabase.from('planned_attendance').select('*').eq('membership_id', membership.id);
      const { data: actual } = await supabase.from('actual_attendance').select('*').eq('membership_id', membership.id);
      const { data: absences } = await supabase.from('absences').select('*').eq('membership_id', membership.id);
      const { data: recurring } = await supabase.from('recurring_absences').select('*').eq('membership_id', membership.id);
      const { data: memberSubs } = await supabase.from('membership_subgroups').select('subgroup_id').eq('membership_id', membership.id);

      return jsonResponse({
        full_name: membership.full_name,
        subgroups: (memberSubs ?? []).map((s: { subgroup_id: string }) => s.subgroup_id),
        planned_answers: (planned ?? []).length,
        actual_marks: (actual ?? []).length,
        absences: absences ?? [],
        recurring_absences: recurring ?? [],
      });
    }

    // ===== DELETE /my-data =====
    if (path === 'my-data' && method === 'DELETE') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      // Delete personal data, keep aggregated stats
      await supabase.from('planned_attendance').delete().eq('membership_id', membership.id);
      await supabase.from('absences').delete().eq('membership_id', membership.id);
      await supabase.from('recurring_absences').delete().eq('membership_id', membership.id);
      await supabase.from('membership_subgroups').delete().eq('membership_id', membership.id);
      // Anonymize actual_attendance records (keep counts, strip name)
      await supabase.from('memberships').update({ full_name: 'Удалённый участник', status: 'left', left_at: new Date().toISOString() }).eq('id', membership.id);
      return jsonResponse(null);
    }

    // ===== PUT /me/settings =====
    if (path === 'me/settings' && method === 'PUT') {
      const body = await req.json();
      const update: Record<string, unknown> = {};
      const allowed = ['theme', 'background', 'reduce_motion', 'lesson_reminder_minutes', 'timezone'];
      for (const key of allowed) {
        if (body[key] !== undefined) update[key] = body[key];
      }
      await supabase.from('users').update(update).eq('id', userId);
      return jsonResponse(null);
    }

    // ===== GET /schedule?from=&to= =====
    if (path === 'schedule' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);

      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;

      const { data: group } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
      const { data: slots } = await supabase.from('schedule_slots').select('*').eq('group_id', membership.group_id);
      const { data: memberSubs } = await supabase.from('membership_subgroups').select('subgroup_id').eq('membership_id', membership.id);
      const subIds = (memberSubs ?? []).map((s: { subgroup_id: string }) => s.subgroup_id);
      const { data: holidays } = await supabase.from('holidays').select('*').eq('group_id', membership.group_id);
      const holidayDates = new Set((holidays ?? []).map((h: { date: string }) => h.date));

      const days: unknown[] = [];
      let d = new Date(from + 'T00:00:00Z');
      const end = new Date(to + 'T00:00:00Z');
      while (d <= end) {
        const dateStr = d.toISOString().slice(0, 10);
        const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();

        // Check work days, holidays, semester
        const workDays = (group?.work_days ?? [1,2,3,4,5]) as number[];
        if (!workDays.includes(weekday) || holidayDates.has(dateStr)) {
          d.setUTCDate(d.getUTCDate() + 1);
          continue;
        }

        const parity = weekParity(dateStr, group?.semester_start ?? null);
        let daySlots = (slots ?? []).filter((s: { weekday: number; parity: string; subgroup_id: string | null }) =>
          s.weekday === weekday &&
          (s.parity === 'all' || (parity && s.parity === parity)) &&
          (s.subgroup_id === null || subIds.includes(s.subgroup_id))
        );

        // Apply overrides
        const { data: overrides } = await supabase
          .from('schedule_overrides')
          .select('*, schedule_slots!inner(*)')
          .eq('group_id', membership.group_id)
          .eq('date', dateStr);

        daySlots = daySlots.map((slot: Record<string, unknown>) => {
          const override = (overrides ?? []).find((o: Record<string, unknown>) => {
            const innerSlot = o['schedule_slots'] as { id: string };
            return innerSlot?.id === slot.id;
          });
          if (!override) return slot;
          const action = override.action as string;
          if (action === 'cancel') return { ...slot, cancelled: true };
          if (action === 'move') return { ...slot, starts: override.new_starts ?? slot.starts, ends: override.new_ends ?? slot.ends, room: override.new_room ?? slot.room, moved: true };
          if (action === 'replace') return { ...slot, subject: override.new_subject ?? slot.subject, teacher: override.new_teacher ?? slot.teacher, room: override.new_room ?? slot.room, moved: true };
          return slot;
        });

        if (daySlots.length > 0) {
          days.push({ date: dateStr, slots: daySlots });
        }
        d.setUTCDate(d.getUTCDate() + 1);
      }

      return jsonResponse(days);
    }

    // ===== GET /schedule/raw =====
    if (path === 'schedule/raw' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const { data: slots } = await supabase.from('schedule_slots').select('*').eq('group_id', membership.group_id);
      const { data: bell } = await supabase.from('bell_schedule').select('*').eq('group_id', membership.group_id).order('lesson_no');
      return jsonResponse({ slots: slots ?? [], bell: bell ?? [] });
    }

    // ===== PUT /schedule/draft =====
    if (path === 'schedule/draft' && method === 'PUT') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      await supabase.from('schedule_drafts').upsert({
        group_id: membership.group_id,
        data: { slots: body.slots, bell: body.bell },
        source: body.source ?? 'manual',
        flags: body.flags ?? [],
        updated_at: new Date().toISOString(),
      });
      return jsonResponse(null);
    }

    // ===== POST /schedule/publish =====
    if (path === 'schedule/publish' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      // Check deputy permission
      if (membership.role === 'deputy') {
        const { data: group } = await supabase.from('groups').select('deputy_can_edit_schedule').eq('id', membership.group_id).single();
        if (!group?.deputy_can_edit_schedule) return errorResponse('FORBIDDEN', 'Нет прав на расписание', 403);
      } else if (membership.role !== 'headman') {
        return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      }

      const { data: draft } = await supabase.from('schedule_drafts').select('*').eq('group_id', membership.group_id).maybeSingle();
      if (!draft) return errorResponse('NOT_FOUND', 'Черновик не найден');

      // Get current version
      const { data: versions } = await supabase.from('schedule_versions').select('version').eq('group_id', membership.group_id).order('version', { ascending: false }).limit(1);
      const nextVersion = ((versions?.[0] as { version: number } | undefined)?.version ?? 0) + 1;

      // Snapshot current slots
      const { data: currentSlots } = await supabase.from('schedule_slots').select('*').eq('group_id', membership.group_id);
      await supabase.from('schedule_versions').insert({
        group_id: membership.group_id,
        version: nextVersion,
        snapshot: { slots: currentSlots ?? [] },
        author_membership_id: membership.id,
      });

      // Replace slots
      await supabase.from('schedule_slots').delete().eq('group_id', membership.group_id);
      const newSlots = (draft.data as { slots: Record<string, unknown>[] }).slots.map((s) => ({ ...s, group_id: membership.group_id }));
      if (newSlots.length) await supabase.from('schedule_slots').insert(newSlots);

      // Update bell schedule
      if ((draft.data as { bell: Record<string, unknown>[] }).bell?.length) {
        await supabase.from('bell_schedule').delete().eq('group_id', membership.group_id);
        const bellRows = (draft.data as { bell: Record<string, unknown>[] }).bell.map((b) => ({ ...b, group_id: membership.group_id }));
        await supabase.from('bell_schedule').insert(bellRows);
      }

      await auditLog(supabase, membership.group_id, userId, 'schedule.publish', 'schedule', membership.group_id, { version: nextVersion });
      return jsonResponse({ version: nextVersion });
    }

    // ===== GET /schedule/versions =====
    if (path === 'schedule/versions' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const { data: versions } = await supabase
        .from('schedule_versions')
        .select('id, version, created_at')
        .eq('group_id', membership.group_id)
        .order('version', { ascending: false });
      return jsonResponse(versions);
    }

    // ===== POST /schedule/versions/:v/rollback =====
    const rollbackMatch = path.match(/^schedule\/versions\/(\d+)\/rollback$/);
    if (rollbackMatch && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (membership.role === 'deputy') {
        const { data: group } = await supabase.from('groups').select('deputy_can_edit_schedule').eq('id', membership.group_id).single();
        if (!group?.deputy_can_edit_schedule) return errorResponse('FORBIDDEN', 'Нет прав', 403);
      } else if (membership.role !== 'headman') {
        return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      }

      const version = parseInt(rollbackMatch[1]);
      const { data: sv } = await supabase.from('schedule_versions').select('*').eq('group_id', membership.group_id).eq('version', version).single();
      if (!sv) return errorResponse('NOT_FOUND', 'Версия не найдена');

      await supabase.from('schedule_slots').delete().eq('group_id', membership.group_id);
      const snapshotSlots = (sv.snapshot as { slots: Record<string, unknown>[] }).slots;
      if (snapshotSlots?.length) {
        await supabase.from('schedule_slots').insert(snapshotSlots.map((s) => ({ ...s, group_id: membership.group_id })));
      }

      await auditLog(supabase, membership.group_id, userId, 'schedule.rollback', 'schedule', membership.group_id, { version });
      return jsonResponse(null);
    }

    // ===== POST/DELETE /schedule/overrides =====
    if (path === 'schedule/overrides' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (membership.role === 'deputy') {
        const { data: group } = await supabase.from('groups').select('deputy_can_edit_schedule').eq('id', membership.group_id).single();
        if (!group?.deputy_can_edit_schedule) return errorResponse('FORBIDDEN', 'Нет прав', 403);
      } else if (membership.role !== 'headman') {
        return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      }

      const body = await req.json();
      const { data: override } = await supabase.from('schedule_overrides').insert({
        group_id: membership.group_id,
        date: body.date,
        slot_id: body.slot_id,
        action: body.action,
        new_starts: body.new_starts ?? null,
        new_ends: body.new_ends ?? null,
        new_room: body.new_room ?? null,
        new_subject: body.new_subject ?? null,
        new_teacher: body.new_teacher ?? null,
        note: body.note ?? null,
        created_by: membership.id,
      }).select('*').single();

      // Queue schedule_change notification
      await auditLog(supabase, membership.group_id, userId, 'schedule.override', 'override', override.id, override);
      return jsonResponse(override);
    }

    const overrideDeleteMatch = path.match(/^schedule\/overrides\/([^/]+)$/);
    if (overrideDeleteMatch && method === 'DELETE') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      await supabase.from('schedule_overrides').delete().eq('id', overrideDeleteMatch[1]);
      return jsonResponse(null);
    }

    // ===== GET/PUT /calendar =====
    if (path === 'calendar' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const { data: group } = await supabase.from('groups').select('semester_start, semester_end, work_days').eq('id', membership.group_id).single();
      const { data: holidays } = await supabase.from('holidays').select('*').eq('group_id', membership.group_id);
      const { data: bell } = await supabase.from('bell_schedule').select('*').eq('group_id', membership.group_id).order('lesson_no');
      return jsonResponse({ ...group, holidays: holidays ?? [], bell: bell ?? [] });
    }

    if (path === 'calendar' && method === 'PUT') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      const update: Record<string, unknown> = {};
      if (body.semester_start !== undefined) update.semester_start = body.semester_start;
      if (body.semester_end !== undefined) update.semester_end = body.semester_end;
      if (body.work_days !== undefined) update.work_days = body.work_days;
      if (Object.keys(update).length) await supabase.from('groups').update(update).eq('id', membership.group_id);

      // Update holidays
      if (body.holidays) {
        await supabase.from('holidays').delete().eq('group_id', membership.group_id);
        if (body.holidays.length) {
          await supabase.from('holidays').insert(body.holidays.map((h: { date: string; note: string }) => ({ group_id: membership.group_id, date: h.date, note: h.note })));
        }
      }

      // Update bell schedule
      if (body.bell) {
        await supabase.from('bell_schedule').delete().eq('group_id', membership.group_id);
        if (body.bell.length) {
          await supabase.from('bell_schedule').insert(body.bell.map((b: { lesson_no: number; starts: string; ends: string }) => ({ group_id: membership.group_id, ...b })));
        }
      }

      return jsonResponse(null);
    }

    // ===== GET /polls/day?date= =====
    if (path === 'polls/day' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

      const { data: group } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
      const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      const wd = weekday === 0 ? 7 : weekday;
      const parity = weekParity(date, group?.semester_start ?? null);

      const { data: slots } = await supabase.from('schedule_slots').select('*').eq('group_id', membership.group_id).eq('weekday', wd);
      const { data: memberSubs } = await supabase.from('membership_subgroups').select('subgroup_id').eq('membership_id', membership.id);
      const subIds = (memberSubs ?? []).map((s: { subgroup_id: string }) => s.subgroup_id);

      let daySlots = (slots ?? []).filter((s: { parity: string; subgroup_id: string | null }) =>
        (s.parity === 'all' || (parity && s.parity === parity)) &&
        (s.subgroup_id === null || subIds.includes(s.subgroup_id))
      );

      const { data: planned } = await supabase.from('planned_attendance').select('*').eq('membership_id', membership.id).eq('date', date);
      const plannedMap = new Map((planned ?? []).map((p: { slot_id: string }) => [p.slot_id, p]));

      return jsonResponse({ date, slots: daySlots, answers: plannedMap.size > 0 ? [...plannedMap.values()] : [] });
    }

    // ===== POST /polls/answer =====
    if (path === 'polls/answer' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const body = await req.json();
      const date = body.date;
      const answers: { slot_id: string; answer: string; reason?: string; comment?: string }[] = body.answers ?? [];

      for (const a of answers) {
        await supabase.from('planned_attendance').upsert({
          group_id: membership.group_id,
          membership_id: membership.id,
          date,
          slot_id: a.slot_id,
          answer: a.answer,
          reason: a.reason ?? null,
          comment: a.comment ?? null,
          answered_at: new Date().toISOString(),
        });
      }

      return jsonResponse(null);
    }

    // ===== POST /absences =====
    if (path === 'absences' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const body = await req.json();
      const { data: absence } = await supabase.from('absences').insert({
        group_id: membership.group_id,
        membership_id: membership.id,
        date_from: body.date_from,
        date_to: body.date_to ?? null,
        reason: body.reason,
        comment: body.comment ?? null,
      }).select('*').single();
      return jsonResponse(absence);
    }

    // ===== PUT /absences/:id/close =====
    const absenceCloseMatch = path.match(/^absences\/([^/]+)\/close$/);
    if (absenceCloseMatch && method === 'PUT') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await supabase.from('absences').update({ date_to: yesterday.toISOString().slice(0, 10), closed_at: new Date().toISOString() }).eq('id', absenceCloseMatch[1]);
      return jsonResponse(null);
    }

    // ===== GET/POST/DELETE /recurring-absences =====
    if (path === 'recurring-absences' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: recurring } = await supabase.from('recurring_absences').select('*').eq('membership_id', membership.id);
      return jsonResponse(recurring);
    }

    if (path === 'recurring-absences' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const body = await req.json();
      const { data: rec } = await supabase.from('recurring_absences').insert({
        group_id: membership.group_id,
        membership_id: membership.id,
        weekday: body.weekday,
        lesson_nos: body.lesson_nos ?? [],
        reason: body.reason,
        comment: body.comment ?? null,
      }).select('*').single();
      return jsonResponse(rec);
    }

    const recurringDeleteMatch = path.match(/^recurring-absences\/([^/]+)$/);
    if (recurringDeleteMatch && method === 'DELETE') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      await supabase.from('recurring_absences').delete().eq('id', recurringDeleteMatch[1]).eq('membership_id', membership.id);
      return jsonResponse(null);
    }

    // ===== GET /journal?date= =====
    if (path === 'journal' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

      const { data: group } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
      const { data: slots } = await supabase.from('schedule_slots').select('*').eq('group_id', membership.group_id);
      const { data: members } = await supabase.from('memberships').select('*').eq('group_id', membership.group_id).eq('status', 'active');
      const { data: planned } = await supabase.from('planned_attendance').select('*').eq('group_id', membership.group_id).eq('date', date);
      const { data: actual } = await supabase.from('actual_attendance').select('*').eq('group_id', membership.group_id).eq('date', date);
      const { data: absences } = await supabase.from('absences').select('*').eq('group_id', membership.group_id).lte('date_from', date).or(`date_to.is.null,date_to.gte.${date}`);
      const { data: recurring } = await supabase.from('recurring_absences').select('*').eq('group_id', membership.group_id);
      const { data: dayState } = await supabase.from('day_state').select('*').eq('group_id', membership.group_id).eq('date', date).maybeSingle();

      const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      const wd = weekday === 0 ? 7 : weekday;
      const parity = weekParity(date, group?.semester_start ?? null);

      const daySlots = (slots ?? []).filter((s: { weekday: number; parity: string }) =>
        s.weekday === wd && (s.parity === 'all' || (parity && s.parity === parity))
      );

      const plannedMap = new Map((planned ?? []).map((p: { membership_id: string; slot_id: string }) => [`${p.membership_id}:${p.slot_id}`, p]));
      const actualMap = new Map((actual ?? []).map((a: { membership_id: string; slot_id: string }) => [`${a.membership_id}:${a.slot_id}`, a]));

      const rows = (members ?? []).map((m: { id: string; full_name: string }) => {
        const memberAbsences = (absences ?? []).filter((a: { membership_id: string }) => a.membership_id === m.id);
        const memberRecurring = (recurring ?? []).filter((r: { membership_id: string; weekday: number }) => r.membership_id === m.id && r.weekday === wd);

        const cells = daySlots.map((slot: { id: string; lesson_no: number }) => {
          const key = `${m.id}:${slot.id}`;
          const a = actualMap.get(key) as { status: string } | undefined;
          const p = plannedMap.get(key) as { answer: string; reason?: string } | undefined;
          const activeAbsence = memberAbsences[0] as { reason: string } | undefined;
          const activeRecurring = memberRecurring.find((r: { lesson_nos: number[] }) => r.lesson_nos?.includes(slot.lesson_no)) as { reason: string } | undefined;

          const status = effectiveStatus({
            slot: { cancelled: false },
            actual: a ? { status: a.status as 'present' | 'absent' | 'late' | 'valid' | 'sick' } : null,
            absence: activeAbsence ? { reason: activeAbsence.reason as 'valid' | 'dont_want' | 'sick' } : null,
            recurring: activeRecurring ? { reason: activeRecurring.reason as 'valid' | 'dont_want' | 'sick' } : null,
            planned: p ? { answer: p.answer as 'will' | 'wont' | 'late', reason: p.reason as 'valid' | 'dont_want' | 'sick' | undefined } : null,
          }, !!dayState?.closed_at);

          return { slot_id: slot.id, status, confirmed: !!a };
        });

        return { membership_id: m.id, full_name: m.full_name, cells };
      });

      return jsonResponse({ date, closed: !!dayState?.closed_at, rows, slots: daySlots });
    }

    // ===== GET /journal/range?from=&to= =====
    if (path === 'journal/range' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;

      const days: unknown[] = [];
      let d = new Date(from + 'T00:00:00Z');
      const end = new Date(to + 'T00:00:00Z');
      while (d <= end) {
        const dateStr = d.toISOString().slice(0, 10);
        // Reuse journal logic
        const { data: dayJournal } = await supabase.functions.invoke('api', { method: 'GET', path: `/journal?date=${dateStr}` }).catch(() => null);
        if (dayJournal) days.push(dayJournal);
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return jsonResponse(days);
    }

    // ===== PUT /attendance =====
    if (path === 'attendance' && method === 'PUT') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();

      if (body.status === null) {
        await supabase.from('actual_attendance').delete().eq('membership_id', body.membership_id).eq('date', body.date).eq('slot_id', body.slot_id);
      } else {
        await supabase.from('actual_attendance').upsert({
          group_id: membership.group_id,
          membership_id: body.membership_id,
          date: body.date,
          slot_id: body.slot_id,
          status: body.status,
          set_by: membership.id,
        });
      }
      await auditLog(supabase, membership.group_id, userId, 'attendance.set', 'attendance', `${body.membership_id}:${body.date}:${body.slot_id}`, { status: body.status });
      return jsonResponse(null);
    }

    // ===== POST /attendance/close-day =====
    if (path === 'attendance/close-day' && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      const date = body.date;

      const { data: group } = await supabase.from('groups').select('*').eq('id', membership.group_id).single();
      const { data: slots } = await supabase.from('schedule_slots').select('*').eq('group_id', membership.group_id);
      const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      const wd = weekday === 0 ? 7 : weekday;
      const parity = weekParity(date, group?.semester_start ?? null);
      const daySlots = (slots ?? []).filter((s: { weekday: number; parity: string }) => s.weekday === wd && (s.parity === 'all' || (parity && s.parity === parity)));

      const { data: members } = await supabase.from('memberships').select('*').eq('group_id', membership.group_id).eq('status', 'active');
      const { data: planned } = await supabase.from('planned_attendance').select('*').eq('group_id', membership.group_id).eq('date', date);
      const { data: actual } = await supabase.from('actual_attendance').select('*').eq('group_id', membership.group_id).eq('date', date);
      const { data: absences } = await supabase.from('absences').select('*').eq('group_id', membership.group_id).lte('date_from', date).or(`date_to.is.null,date_to.gte.${date}`);
      const { data: recurring } = await supabase.from('recurring_absences').select('*').eq('group_id', membership.group_id);

      const actualMap = new Set((actual ?? []).map((a: { membership_id: string; slot_id: string }) => `${a.membership_id}:${a.slot_id}`));
      const plannedMap = new Map((planned ?? []).map((p: { membership_id: string; slot_id: string }) => [`${p.membership_id}:${p.slot_id}`, p]));

      const noDataMembers: string[] = [];

      for (const m of members ?? []) {
        const memberSubs = await supabase.from('membership_subgroups').select('subgroup_id').eq('membership_id', m.id);
        const subIds = (memberSubs.data ?? []).map((s: { subgroup_id: string }) => s.subgroup_id);
        const memberSlots = daySlots.filter((s: { subgroup_id: string | null }) => s.subgroup_id === null || subIds.includes(s.subgroup_id));

        for (const slot of memberSlots) {
          const key = `${m.id}:${slot.id}`;
          if (actualMap.has(key)) continue;

          const p = plannedMap.get(key) as { answer: string; reason?: string } | undefined;
          const memberAbsence = (absences ?? []).find((a: { membership_id: string }) => a.membership_id === m.id);
          const memberRecurring = (recurring ?? []).find((r: { membership_id: string; weekday: number; lesson_nos: number[] }) => r.membership_id === m.id && r.weekday === wd && r.lesson_nos?.includes(slot.lesson_no));

          const fact = closeDayMapping(
            p ? { answer: p.answer as 'will' | 'wont' | 'late', reason: p.reason as 'valid' | 'dont_want' | 'sick' | null } : null,
            memberAbsence ? { reason: memberAbsence.reason as 'valid' | 'dont_want' | 'sick' } : null,
            memberRecurring ? { reason: memberRecurring.reason as 'valid' | 'dont_want' | 'sick' } : null,
          );

          if (fact) {
            await supabase.from('actual_attendance').upsert({
              group_id: membership.group_id,
              membership_id: m.id,
              date,
              slot_id: slot.id,
              status: fact,
              set_by: membership.id,
            });
          } else {
            noDataMembers.push(m.full_name);
          }
        }
      }

      if (noDataMembers.length > 0 && !body.force) {
        return errorResponse('CONFLICT', `У ${noDataMembers.length} человек нет отметки`, 409);
      }

      await supabase.from('day_state').upsert({
        group_id: membership.group_id,
        date,
        closed_at: new Date().toISOString(),
        closed_by: membership.id,
      });
      await auditLog(supabase, membership.group_id, userId, 'attendance.close_day', 'day_state', date, null);

      return jsonResponse(null);
    }

    // ===== POST /attendance/reopen-day =====
    if (path === 'attendance/reopen-day' && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      await supabase.from('day_state').update({ closed_at: null, closed_by: null }).eq('group_id', membership.group_id).eq('date', body.date);
      await auditLog(supabase, membership.group_id, userId, 'attendance.reopen_day', 'day_state', body.date, null);
      return jsonResponse(null);
    }

    // ===== GET /stats?from=&to= =====
    if (path === 'stats' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;

      const { data: actual } = await supabase.from('actual_attendance').select('status').eq('group_id', membership.group_id).gte('date', from).lte('date', to);
      const counts: Record<string, number> = { present: 0, late: 0, absent: 0, valid: 0, sick: 0, no_data: 0, cancelled: 0 };
      for (const a of actual ?? []) {
        const s = (a as { status: string }).status;
        if (counts[s] !== undefined) counts[s]++;
      }
      const { rate, rateWithValid } = calcRate({
        present: counts.present, late: counts.late, absent: counts.absent,
        valid: counts.valid, sick: counts.sick,
      });

      return jsonResponse({
        total_slots: Object.values(counts).reduce((a, b) => a + b, 0),
        ...counts,
        rate,
        rate_with_valid: rateWithValid,
      });
    }

    // ===== GET /stats/me =====
    if (path === 'stats/me' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: actual } = await supabase.from('actual_attendance').select('status').eq('membership_id', membership.id);

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

    // ===== POST /summary/nudge =====
    if (path === 'summary/nudge' && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const allowed = await checkRateLimit(supabase, `nudge_unanswered:${membership.group_id}`, 1, 0.5);
      if (!allowed) return errorResponse('RATE_LIMIT', 'Не чаще раза в 30 минут');
      // Queue nudge deliveries for unanswered members
      return jsonResponse(null);
    }

    // ===== GET /announcements =====
    if (path === 'announcements' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: anns } = await supabase
        .from('announcements')
        .select('*')
        .eq('group_id', membership.group_id)
        .not('published_at', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const { data: reads } = await supabase.from('announcement_reads').select('announcement_id').eq('membership_id', membership.id);
      const readIds = new Set((reads ?? []).map((r: { announcement_id: string }) => r.announcement_id));

      const result = (anns ?? []).map((a: Record<string, unknown>) => ({ ...a, unread: !readIds.has(a.id as string) }));
      return jsonResponse(result);
    }

    // ===== POST /announcements =====
    if (path === 'announcements' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      if (!requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      if (membership.role === 'deputy') {
        const { data: group } = await supabase.from('groups').select('deputy_can_announce').eq('id', membership.group_id).single();
        if (!group?.deputy_can_announce) return errorResponse('FORBIDDEN', 'Нет прав на объявления', 403);
      }

      // Rate limit: 10 per day, 3 urgent
      const allowed = await checkRateLimit(supabase, `announcements:${membership.group_id}`, 10, 24);
      if (!allowed) return errorResponse('RATE_LIMIT', 'Не более 10 объявлений в сутки');
      const body = await req.json();
      if (body.urgent) {
        const urgentAllowed = await checkRateLimit(supabase, `announcements_urgent:${membership.group_id}`, 3, 24);
        if (!urgentAllowed) return errorResponse('RATE_LIMIT', 'Не более 3 срочных в сутки');
      }

      const { data: ann } = await supabase.from('announcements').insert({
        group_id: membership.group_id,
        author_id: membership.id,
        title: body.title,
        body: body.body,
        urgent: body.urgent ?? false,
        pinned: body.pinned ?? false,
        audience: body.audience ?? 'all',
        send_at: body.send_at ?? new Date().toISOString(),
        published_at: body.send_at ? null : new Date().toISOString(),
      }).select('*').single();

      await auditLog(supabase, membership.group_id, userId, 'announcement.create', 'announcement', ann.id, null);
      return jsonResponse(ann);
    }

    // ===== PUT/DELETE /announcements/:id =====
    const annMatch = path.match(/^announcements\/([^/]+)$/);
    if (annMatch && method === 'PUT') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const body = await req.json();
      const { data: ann } = await supabase.from('announcements').select('*').eq('id', annMatch[1]).eq('group_id', membership.group_id).maybeSingle();
      if (!ann) return errorResponse('NOT_FOUND', 'Объявление не найдено');
      if (ann.author_id !== membership.id && membership.role !== 'headman') return errorResponse('FORBIDDEN', 'Нет прав', 403);

      const { data: updated } = await supabase.from('announcements').update({
        title: body.title ?? ann.title,
        body: body.body ?? ann.body,
        urgent: body.urgent ?? ann.urgent,
        pinned: body.pinned ?? ann.pinned,
        edited_at: new Date().toISOString(),
      }).eq('id', annMatch[1]).select('*').single();

      // Reset reads for urgent
      if (body.urgent) {
        await supabase.from('announcement_reads').delete().eq('announcement_id', annMatch[1]);
      }

      await auditLog(supabase, membership.group_id, userId, 'announcement.edit', 'announcement', annMatch[1], { before: ann, after: updated });
      return jsonResponse(updated);
    }

    if (annMatch && method === 'DELETE') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: ann } = await supabase.from('announcements').select('author_id').eq('id', annMatch[1]).eq('group_id', membership.group_id).maybeSingle();
      if (!ann) return errorResponse('NOT_FOUND', 'Объявление не найдено');
      if (ann.author_id !== membership.id && membership.role !== 'headman') return errorResponse('FORBIDDEN', 'Нет прав', 403);

      await supabase.from('announcements').update({ deleted_at: new Date().toISOString() }).eq('id', annMatch[1]);
      await auditLog(supabase, membership.group_id, userId, 'announcement.delete', 'announcement', annMatch[1], null);
      return jsonResponse(null);
    }

    // ===== POST /announcements/:id/read =====
    const readMatch = path.match(/^announcements\/([^/]+)\/read$/);
    if (readMatch && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      await supabase.from('announcement_reads').upsert({
        announcement_id: readMatch[1],
        membership_id: membership.id,
        read_at: new Date().toISOString(),
      });
      return jsonResponse(null);
    }

    // ===== POST /announcements/read-all =====
    if (path === 'announcements/read-all' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: anns } = await supabase.from('announcements').select('id').eq('group_id', membership.group_id).not('published_at', 'is', null).is('deleted_at', null);
      for (const a of anns ?? []) {
        await supabase.from('announcement_reads').upsert({
          announcement_id: (a as { id: string }).id,
          membership_id: membership.id,
          read_at: new Date().toISOString(),
        });
      }
      return jsonResponse(null);
    }

    // ===== GET /announcements/:id/readers =====
    const readersMatch = path.match(/^announcements\/([^/]+)\/readers$/);
    if (readersMatch && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const { data: members } = await supabase.from('memberships').select('id, full_name, users!inner(telegram_id, bot_blocked)').eq('group_id', membership.group_id).eq('status', 'active');
      const { data: reads } = await supabase.from('announcement_reads').select('membership_id').eq('announcement_id', readersMatch[1]);
      const readIds = new Set((reads ?? []).map((r: { membership_id: string }) => r.membership_id));

      const result = (members ?? []).map((m: { id: string; full_name: string; users: { bot_blocked: boolean } }) => ({
        membership_id: m.id,
        full_name: m.full_name,
        read: readIds.has(m.id),
        bot_blocked: m.users?.bot_blocked ?? false,
      }));
      return jsonResponse(result);
    }

    // ===== POST /announcements/:id/nudge =====
    const nudgeMatch = path.match(/^announcements\/([^/]+)\/nudge$/);
    if (nudgeMatch && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const allowed = await checkRateLimit(supabase, `nudge_unread:${nudgeMatch[1]}`, 1, 1);
      if (!allowed) return errorResponse('RATE_LIMIT', 'Не чаще раза в час');
      return jsonResponse(null);
    }

    // ===== GET/POST/DELETE /announcement-templates =====
    if (path === 'announcement-templates' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const { data: templates } = await supabase.from('announcement_templates').select('*').or(`group_id.is.null,group_id.eq.${membership.group_id}`);
      return jsonResponse(templates);
    }

    if (path === 'announcement-templates' && method === 'POST') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const body = await req.json();
      const { data: tpl } = await supabase.from('announcement_templates').insert({ group_id: membership.group_id, title: body.title, body: body.body }).select('*').single();
      return jsonResponse(tpl);
    }

    const templateDeleteMatch = path.match(/^announcement-templates\/([^/]+)$/);
    if (templateDeleteMatch && method === 'DELETE') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      await supabase.from('announcement_templates').delete().eq('id', templateDeleteMatch[1]).eq('group_id', membership.group_id);
      return jsonResponse(null);
    }

    // ===== POST /leadership/transfer =====
    if (path === 'leadership/transfer' && method === 'POST') {
      if (!membership || !requireHeadman(auth)) return errorResponse('FORBIDDEN', 'Только староста', 403);
      const body = await req.json();
      if (body.confirm !== 'ПЕРЕДАТЬ') return errorResponse('VALIDATION', 'Введите слово ПЕРЕДАТЬ');

      const { data: transfer } = await supabase.from('transfer_requests').insert({
        group_id: membership.group_id,
        from_id: membership.id,
        to_id: body.to_id,
        keep_as_deputy: body.keep_as_deputy ?? false,
        status: 'pending',
        expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
      }).select('*').single();

      await auditLog(supabase, membership.group_id, userId, 'leadership.transfer', 'transfer_request', transfer.id, null);
      return jsonResponse(transfer);
    }

    const transferAcceptMatch = path.match(/^leadership\/transfer\/([^/]+)\/accept$/);
    if (transferAcceptMatch && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const transferId = transferAcceptMatch[1];
      const { data: transfer } = await supabase.from('transfer_requests').select('*').eq('id', transferId).maybeSingle();
      if (!transfer || transfer.status !== 'pending') return errorResponse('NOT_FOUND', 'Заявка не найдена');
      if (transfer.to_id !== membership.id) return errorResponse('FORBIDDEN', 'Это не ваша заявка', 403);

      // Swap roles
      await supabase.from('memberships').update({ role: 'headman' }).eq('id', transfer.to_id);
      await supabase.from('memberships').update({ role: transfer.keep_as_deputy ? 'deputy' : 'student' }).eq('id', transfer.from_id);
      await supabase.from('transfer_requests').update({ status: 'accepted', revert_until: new Date(Date.now() + 24 * 3600000).toISOString() }).eq('id', transferId);
      await supabase.from('leadership_events').insert({ group_id: membership.group_id, type: 'transfer', actor_id: transfer.from_id, target_id: membership.id });
      return jsonResponse(null);
    }

    const transferDeclineMatch = path.match(/^leadership\/transfer\/([^/]+)\/decline$/);
    if (transferDeclineMatch && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      await supabase.from('transfer_requests').update({ status: 'cancelled' }).eq('id', transferDeclineMatch[1]).eq('to_id', membership.id);
      return jsonResponse(null);
    }

    const transferCancelMatch = path.match(/^leadership\/transfer\/([^/]+)\/cancel$/);
    if (transferCancelMatch && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      await supabase.from('transfer_requests').update({ status: 'cancelled' }).eq('id', transferCancelMatch[1]).eq('from_id', membership.id);
      return jsonResponse(null);
    }

    // ===== GET /leadership/vote =====
    if (path === 'leadership/vote' && method === 'GET') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: vote } = await supabase.from('votes').select('*').eq('group_id', membership.group_id).eq('status', 'open').maybeSingle();
      if (!vote) return jsonResponse(null);

      const { data: candidates } = await supabase.from('vote_candidates').select('membership_id').eq('vote_id', vote.id);
      const { data: myBallot } = await supabase.from('vote_ballots').select('candidate_id').eq('vote_id', vote.id).eq('voter_id', membership.id).maybeSingle();

      return jsonResponse({ ...vote, candidates: candidates ?? [], my_vote: myBallot?.candidate_id ?? null });
    }

    // ===== POST /leadership/vote/start =====
    if (path === 'leadership/vote/start' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      // Check headman inactive 14+ days
      const { data: headman } = await supabase.from('memberships').select('last_active_at').eq('group_id', membership.group_id).eq('role', 'headman').eq('status', 'active').maybeSingle();
      if (headman) {
        const inactive = new Date(headman.last_active_at).getTime() < Date.now() - 14 * 86400000;
        if (!inactive) return errorResponse('FORBIDDEN', 'Староста активен', 403);
      }

      const { data: existing } = await supabase.from('votes').select('id').eq('group_id', membership.group_id).eq('status', 'open').maybeSingle();
      if (existing) return errorResponse('CONFLICT', 'Голосование уже идёт');

      const { data: vote } = await supabase.from('votes').insert({
        group_id: membership.group_id,
        status: 'open',
        closes_at: new Date(Date.now() + 48 * 3600000).toISOString(),
      }).select('*').single();

      await supabase.from('leadership_events').insert({ group_id: membership.group_id, type: 'vote_started', actor_id: membership.id });
      return jsonResponse(vote);
    }

    // ===== POST /leadership/vote/candidate =====
    if (path === 'leadership/vote/candidate' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const { data: vote } = await supabase.from('votes').select('*').eq('group_id', membership.group_id).eq('status', 'open').maybeSingle();
      if (!vote) return errorResponse('NOT_FOUND', 'Нет активного голосования');

      await supabase.from('vote_candidates').upsert({ vote_id: vote.id, membership_id: membership.id });
      return jsonResponse(null);
    }

    // ===== POST /leadership/vote/ballot =====
    if (path === 'leadership/vote/ballot' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const body = await req.json();
      const { data: vote } = await supabase.from('votes').select('*').eq('group_id', membership.group_id).eq('status', 'open').maybeSingle();
      if (!vote) return errorResponse('NOT_FOUND', 'Нет активного голосования');

      // Check candidate exists
      const { data: candidate } = await supabase.from('vote_candidates').select('*').eq('vote_id', vote.id).eq('membership_id', body.candidate_id).maybeSingle();
      if (!candidate) return errorResponse('NOT_FOUND', 'Кандидат не найден');

      await supabase.from('vote_ballots').upsert({ vote_id: vote.id, voter_id: membership.id, candidate_id: body.candidate_id });
      return jsonResponse(null);
    }

    // ===== GET /help/faq?q= =====
    if (path.startsWith('help/faq') && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const faq = [
        { id: 'headman_gone', q: 'Что делать, если староста ушёл', a: 'Если староста неактивен 14+ дней, любой участник может запустить голосование.' },
        { id: 'no_polls', q: 'Почему не приходят опросы', a: 'Опросы приходят только в рабочие дни, когда есть пары, и расписание опубликовано.' },
        { id: 'timezone', q: 'Как сменить часовой пояс', a: 'Часовой пояс группы меняется в Настройки → Группа. Личный пояс — в Настройки профиля.' },
        { id: 'subgroup', q: 'Как поменять подгруппу', a: 'Мои подгруппы можно сменить в Настройках, изменение отправляется старосте.' },
      ];
      const filtered = q ? faq.filter((f) => f.q.toLowerCase().includes(q.toLowerCase()) || f.a.toLowerCase().includes(q.toLowerCase())) : faq;
      return jsonResponse(filtered);
    }

    // ===== POST /bug-reports =====
    if (path === 'bug-reports' && method === 'POST') {
      const allowed = await checkRateLimit(supabase, `bug_reports:${userId}`, 5, 24);
      if (!allowed) return errorResponse('RATE_LIMIT', 'Не более 5 жалоб в сутки');

      const body = await req.json();
      const { data: report } = await supabase.from('bug_reports').insert({
        user_id: userId,
        group_id: membership?.group_id ?? null,
        text: body.text,
        screenshot_path: body.screenshot_path ?? null,
        context: body.context ?? {},
      }).select('*').single();

      return jsonResponse({ id: report.id, status: 'new' });
    }

    // ===== POST /complaints =====
    if (path === 'complaints' && method === 'POST') {
      if (!membership) return errorResponse('FORBIDDEN', 'Нет группы', 403);
      const body = await req.json();
      await supabase.from('complaints').insert({
        user_id: userId,
        group_id: membership.group_id,
        text: body.text,
      });
      return jsonResponse(null);
    }

    // ===== Admin routes =====
    const ADMIN_TELEGRAM_ID = parseInt(Deno.env.get('ADMIN_TELEGRAM_ID') ?? '0');
    const isAdmin = auth.telegramUser.id === ADMIN_TELEGRAM_ID;

    if (path === 'admin/stats' && method === 'GET') {
      if (!isAdmin) return errorResponse('FORBIDDEN', 'Только админ', 403);
      const { count: groupCount } = await supabase.from('groups').select('id', { count: 'exact', head: true });
      const { count: userCount } = await supabase.from('users').select('id', { count: 'exact', head: true });
      const activeSince = new Date(Date.now() - 86400000).toISOString();
      const { count: activeCount } = await supabase.from('users').select('id', { count: 'exact', head: true }).gte('last_seen_at', activeSince);
      const { count: noHeadman } = await supabase.from('groups').select('id', { count: 'exact', head: true }).eq('state', 'no_headman');
      return jsonResponse({ groups: groupCount, users: userCount, active_24h: activeCount, no_headman_groups: noHeadman });
    }

    if (path === 'admin/tickets' && method === 'GET') {
      if (!isAdmin) return errorResponse('FORBIDDEN', 'Только админ', 403);
      const { data: tickets } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(50);
      return jsonResponse(tickets);
    }

    const ticketStatusMatch = path.match(/^admin\/tickets\/(\d+)\/status$/);
    if (ticketStatusMatch && method === 'POST') {
      if (!isAdmin) return errorResponse('FORBIDDEN', 'Только админ', 403);
      const body = await req.json();
      const ticketId = parseInt(ticketStatusMatch[1]);
      await supabase.from('bug_reports').update({ status: body.status, resolved_at: body.status === 'fixed' ? new Date().toISOString() : null }).eq('id', ticketId);
      return jsonResponse(null);
    }

    if (path === 'admin/broadcast' && method === 'POST') {
      if (!isAdmin) return errorResponse('FORBIDDEN', 'Только админ', 403);
      // Queue broadcast deliveries
      return jsonResponse(null);
    }

    if (path === 'admin/block' && method === 'POST') {
      if (!isAdmin) return errorResponse('FORBIDDEN', 'Только админ', 403);
      const body = await req.json();
      if (body.group_id) {
        await supabase.from('groups').update({ state: 'no_headman' }).eq('id', body.group_id);
      }
      if (body.user_id) {
        await supabase.from('users').update({ bot_blocked: true }).eq('id', body.user_id);
      }
      return jsonResponse(null);
    }

    // ===== GET /schedule/template.csv =====
    if (path === 'schedule/template.csv' && method === 'GET') {
      if (!membership || !requireStaff(auth)) return errorResponse('FORBIDDEN', 'Только староста или зам', 403);
      const csv = 'day,lesson_no,starts,ends,subject,teacher,room,kind,parity,subgroup\n1,1,08:30,10:00,Математика,Иванов И.И.,305,lecture,all,\n';
      return new Response(csv, { headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8' } });
    }

    return errorResponse('NOT_FOUND', `Маршрут не найден: ${method} ${path}`, 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse('INTERNAL', msg, 500);
  }
});
