// Telegram Bot API helpers for Edge Functions

export async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  options?: {
    replyMarkup?: Record<string, unknown>;
    disableNotification?: boolean;
    parseMode?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
      ...(options?.disableNotification !== undefined ? { disable_notification: options.disableNotification } : {}),
      ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
    };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.description };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch {
    // ignore
  }
}

export async function setWebhook(token: string, url: string, secretToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secretToken }),
    });
    const json = await res.json();
    return json.ok === true;
  } catch {
    return false;
  }
}
