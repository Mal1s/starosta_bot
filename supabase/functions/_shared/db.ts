// Database helpers for Edge Functions

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function findOrCreateUser(telegramUser: {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}): Promise<{ id: string; telegram_id: number } | null> {
  const supabase = getSupabaseClient();
  
  const { data: existing } = await supabase
    .from('users')
    .select('id, telegram_id')
    .eq('telegram_id', telegramUser.id)
    .maybeSingle();

  if (existing) {
    // Update last active
    await supabase
      .from('users')
      .update({
        first_name: telegramUser.first_name ?? null,
        last_name: telegramUser.last_name ?? null,
        username: telegramUser.username ?? null,
        last_active_at: new Date().toISOString(),
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

export async function getUserMembership(userId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('memberships')
    .select('*, groups(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .maybeSingle();
  return data;
}
