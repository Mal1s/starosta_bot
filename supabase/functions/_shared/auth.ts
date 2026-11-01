// Telegram initData verification for Edge Functions
// Validates HMAC-SHA256 signature per Telegram WebApp spec

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

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export async function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400,
): Promise<TelegramUser | null> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const dataCheck = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const enc = new TextEncoder();

    const hmac = async (key: ArrayBuffer | Uint8Array, msg: string): Promise<Uint8Array> => {
      const k = await crypto.subtle.importKey(
        'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      );
      return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
    };

    const secret = await hmac(enc.encode('WebAppData'), botToken);
    const calc = await hmac(secret, dataCheck);
    const calcHex = [...calc].map((b) => b.toString(16).padStart(2, '0')).join('');

    const calcBytes = enc.encode(calcHex);
    const hashBytes = enc.encode(hash);
    if (!timingSafeEqual(calcBytes, hashBytes)) return null;

    const authDate = Number(params.get('auth_date'));
    if (Date.now() / 1000 - authDate > maxAgeSec) return null;

    const userJson = params.get('user');
    if (!userJson) return null;
    const user = JSON.parse(userJson) as TelegramUser;
    if (!user.id) return null;

    return user;
  } catch {
    return null;
  }
}
