// Telegram initData verification for Edge Functions
// Validates HMAC-SHA256 signature per Telegram spec

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
  startParam?: string;
}

function botTokenToSecretKey(token: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(token);
}

export function verifyInitData(initData: string, botToken: string): VerifiedInitData | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = botTokenToSecretKey(botToken);
    const secretKeyHmac = createHmac('sha256', secretKey as unknown as string)
      .update('WebAppData')
      .digest();

    const computedHash = createHmac('sha256', secretKeyHmac)
      .update(dataCheckString)
      .digest('hex');

    const computedBytes = Buffer.from(computedHash, 'hex');
    const hashBytes = Buffer.from(hash, 'hex');

    if (computedBytes.length !== hashBytes.length) return null;
    if (!timingSafeEqual(computedBytes, hashBytes)) return null;

    const authDateStr = params.get('auth_date');
    if (!authDateStr) return null;
    const authDate = parseInt(authDateStr, 10);

    // Reject if older than 24 hours
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    const userJson = params.get('user');
    if (!userJson) return null;
    const user = JSON.parse(userJson) as TelegramUser;
    if (!user.id) return null;

    const startParam = params.get('start_param') ?? undefined;

    return { user, authDate, startParam };
  } catch {
    return null;
  }
}
