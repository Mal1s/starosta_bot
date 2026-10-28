// Edge Function: bot-webhook — Telegram Bot webhook handler
// Receives updates from Telegram, handles commands, callback queries,
// and sets the Mini App button.

import { verifyInitData } from '../_shared/auth.ts';
import { findOrCreateUser, getSupabaseClient, getUserMembership } from '../_shared/db.ts';
import { sendTelegramMessage, answerCallbackQuery } from '../_shared/telegram.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const BOT_USERNAME = Deno.env.get('BOT_USERNAME') ?? 'starostaa_help_bot';
const APP_URL = Deno.env.get('APP_URL') ?? '';
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from: { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; last_name?: string; username?: string };
    message?: { chat: { id: number }; message_id: number };
    data: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET /set-webhook — convenience to register webhook with Telegram
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.pathname.replace(/^\/+/, '').endsWith('set-webhook') || url.searchParams.has('set_webhook')) {
      if (!APP_URL || !WEBHOOK_SECRET) {
        return jsonResponse({ ok: false, error: 'APP_URL or TELEGRAM_WEBHOOK_SECRET not set' }, 500);
      }
      const webhookUrl = `${APP_URL}/functions/v1/bot-webhook`;
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, secret_token: WEBHOOK_SECRET }),
      });
      const tgJson = await tgRes.json();
      return jsonResponse({ ok: tgJson.ok, result: tgJson });
    }
    return jsonResponse({ status: 'ok', webhook: 'bot-webhook' });
  }

  try {
    // Verify Telegram webhook secret header
    const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: 'Invalid secret' }, 403);
    }

    const update: TelegramUpdate = await req.json();
    const supabase = getSupabaseClient();

    // Handle callback query
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id ?? 0;
      await answerCallbackQuery(BOT_TOKEN, cq.id);

      if (cq.data === 'open_app') {
        await sendTelegramMessage(BOT_TOKEN, chatId, 'Нажмите кнопку ниже, чтобы открыть приложение 👇', {
          replyMarkup: {
            inline_keyboard: [[
              { text: 'Открыть Староста Бот', web_app: { url: APP_URL } },
            ]],
          },
        });
      } else if (cq.data?.startsWith('approve_')) {
        const membershipId = cq.data.replace('approve_', '');
        await supabase.from('memberships').update({ status: 'active', joined_at: new Date().toISOString() }).eq('id', membershipId);
        const { data: membership } = await supabase.from('memberships').select('user_id, group_id').eq('id', membershipId).single();
        if (membership) {
          const { data: user } = await supabase.from('users').select('telegram_id').eq('id', membership.user_id).single();
          if (user) {
            await sendTelegramMessage(BOT_TOKEN, user.telegram_id, 'Вас приняли в группу! Откройте приложение, чтобы начать 👇', {
              replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
            });
          }
        }
        await sendTelegramMessage(BOT_TOKEN, chatId, 'Участник одобрен ✓');
      } else if (cq.data?.startsWith('reject_')) {
        const membershipId = cq.data.replace('reject_', '');
        await supabase.from('memberships').update({ status: 'rejected' }).eq('id', membershipId);
        const { data: membership } = await supabase.from('memberships').select('user_id').eq('id', membershipId).single();
        if (membership) {
          const { data: user } = await supabase.from('users').select('telegram_id').eq('id', membership.user_id).single();
          if (user) {
            await sendTelegramMessage(BOT_TOKEN, user.telegram_id, 'К сожалению, ваша заявка на вступление отклонена.');
          }
        }
        await sendTelegramMessage(BOT_TOKEN, chatId, 'Заявка отклонена ✗');
      }

      return jsonResponse({ ok: true });
    }

    // Handle message
    if (update.message?.text) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const fromUser = msg.from;
      const text = msg.text;

      // /start or /start <invite_token>
      if (text === '/start' || text.startsWith('/start ')) {
        const startParam = text.startsWith('/start ') ? text.split(' ')[1] : undefined;

        // Create/update user
        await findOrCreateUser({
          id: fromUser.id,
          first_name: fromUser.first_name,
          last_name: fromUser.last_name,
          username: fromUser.username,
          language_code: fromUser.language_code,
        });

        // Check if already has membership
        const { data: userRec } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', fromUser.id)
          .maybeSingle();

        let membership: { id: string; status: string; groups?: { name?: string } } | null = null;
        if (userRec) {
          const mem = await getUserMembership(userRec.id);
          membership = mem as { id: string; status: string; groups?: { name?: string } } | null;
        }

        if (membership && membership.status === 'active') {
          const groupName = membership.groups?.name ?? 'ваша группа';
          await sendTelegramMessage(
            BOT_TOKEN,
            chatId,
            `Привет, ${fromUser.first_name ?? ''}! Вы уже состоите в группе «${groupName}». Откройте приложение:`,
            {
              replyMarkup: {
                inline_keyboard: [[
                  { text: 'Открыть приложение', web_app: { url: APP_URL } },
                ]],
              },
            }
          );
          return jsonResponse({ ok: true });
        }

        if (startParam) {
          // Try invite token join
          const { data: group } = await supabase
            .from('groups')
            .select('id, name, short_code, join_mode, member_limit')
            .eq('invite_token', startParam)
            .maybeSingle();

          if (group) {
            // Auto-join or pending
            const status = group.join_mode === 'auto' ? 'active' : 'pending';
            if (userRec) {
              const { data: existing } = await supabase
                .from('memberships')
                .select('id, status')
                .eq('group_id', group.id)
                .eq('user_id', userRec.id)
                .maybeSingle();

              if (existing) {
                if (existing.status === 'rejected' || existing.status === 'removed') {
                  await supabase.from('memberships').update({ status, full_name: `${fromUser.first_name ?? ''} ${fromUser.last_name ?? ''}`.trim() }).eq('id', existing.id);
                }
              } else {
                await supabase.from('memberships').insert({
                  group_id: group.id,
                  user_id: userRec.id,
                  role: 'student',
                  status,
                  full_name: `${fromUser.first_name ?? ''} ${fromUser.last_name ?? ''}`.trim(),
                });
              }

              if (status === 'active') {
                await sendTelegramMessage(BOT_TOKEN, chatId, `Добро пожаловать в группу «${group.name}»! Откройте приложение:`, {
                  replyMarkup: { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: APP_URL } }]] },
                });
              } else {
                // Notify headman
                const { data: headman } = await supabase
                  .from('memberships')
                  .select('user_id, full_name')
                  .eq('group_id', group.id)
                  .eq('role', 'headman')
                  .eq('status', 'active')
                  .maybeSingle();

                if (headman) {
                  const { data: headmanUser } = await supabase.from('users').select('telegram_id').eq('id', headman.user_id).maybeSingle();
                  if (headmanUser) {
                    const newMemberName = `${fromUser.first_name ?? ''} ${fromUser.last_name ?? ''}`.trim();
                    const newMemberId = userRec.id;
                    await sendTelegramMessage(
                      BOT_TOKEN,
                      headmanUser.telegram_id,
                      `Новая заявка на вступление от ${newMemberName}.`,
                      {
                        replyMarkup: {
                          inline_keyboard: [[
                            { text: 'Одобрить', callback_data: `approve_${newMemberId}` },
                            { text: 'Отклонить', callback_data: `reject_${newMemberId}` },
                          ]],
                        },
                      }
                    );
                  }
                }
                await sendTelegramMessage(BOT_TOKEN, chatId, 'Заявка отправлена. Ожидайте одобрения от старосты.');
              }
            }
            return jsonResponse({ ok: true });
          }
        }

        // Generic /start without invite
        await sendTelegramMessage(
          BOT_TOKEN,
          chatId,
          `Привет, ${fromUser.first_name ?? ''}! Я бот-староста для учёта посещаемости.\n\nОткройте приложение, чтобы создать группу или присоединиться к существующей:`,
          {
            replyMarkup: {
              inline_keyboard: [[
                { text: 'Открыть приложение', web_app: { url: APP_URL } },
              ]],
            },
          }
        );
        return jsonResponse({ ok: true });
      }

      if (text === '/help') {
        await sendTelegramMessage(
          BOT_TOKEN,
          chatId,
          'Староста Бот — учёт посещаемости для учебных групп.\n\nКоманды:\n/start — открыть приложение\n/help — эта справка\n\nНажмите кнопку, чтобы открыть Mini App:',
          {
            replyMarkup: {
              inline_keyboard: [[
                { text: 'Открыть приложение', web_app: { url: APP_URL } },
              ]],
            },
          }
        );
        return jsonResponse({ ok: true });
      }

      if (text === '/group') {
        const { data: userRec } = await supabase.from('users').select('id').eq('telegram_id', fromUser.id).maybeSingle();
        if (userRec) {
          const membership = await getUserMembership(userRec.id);
          if (membership && membership.status === 'active') {
            const groupName = (membership as { groups?: { name?: string } }).groups?.name ?? 'группа';
            await sendTelegramMessage(BOT_TOKEN, chatId, `Ваша группа: ${groupName}`, {
              replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
            });
            return jsonResponse({ ok: true });
          }
        }
        await sendTelegramMessage(BOT_TOKEN, chatId, 'Вы пока не состоите в группе. Откройте приложение, чтобы создать или присоединиться:', {
          replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
        });
        return jsonResponse({ ok: true });
      }

      // Default: show app button
      await sendTelegramMessage(BOT_TOKEN, chatId, 'Откройте приложение Староста Бот:', {
        replyMarkup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] },
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
