// Database helpers for Edge Functions

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { TelegramUser } from './auth.ts';

export function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface DbUser {
  id: string;
  telegram_id: number;
}

export async function findOrCreateUser(telegramUser: TelegramUser): Promise<DbUser | null> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('users')
    .select('id, telegram_id')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('users')
      .update({
        first_name: telegramUser.first_name ?? null,
        last_name: telegramUser.last_name ?? null,
        username: telegramUser.username ?? null,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return existing;
  }

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramUser.id,
      first_name: telegramUser.first_name ?? null,
      last_name: telegramUser.last_name ?? null,
      username: telegramUser.username ?? null,
      language_code: telegramUser.language_code ?? 'ru',
    })
    .select('id, telegram_id')
    .single();

  if (error || !newUser) return null;
  return newUser;
}

export interface MembershipWithContext {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  status: string;
  full_name: string;
  joined_at: string;
  left_at: string | null;
  groups: Record<string, unknown> | null;
}

export async function getUserMembership(userId: string): Promise<MembershipWithContext | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('memberships')
    .select('*, groups(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle();
  return data as MembershipWithContext | null;
}

export async function updateUserActivity(membershipId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('memberships')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', membershipId);
}

export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
