/**
 * Proste zabezpieczenie hasłem dla tras /planning.
 *
 *  - Hasło: env `PLANNING_PASSWORD` (plain string, porównanie timing-safe).
 *  - Sesja: HMAC-podpisany token w HttpOnly cookie, ważny 8h.
 *  - Sekret: env `PLANNING_SESSION_SECRET` (losowy hex, ≥32 bajty).
 *
 * Server-side (Node crypto). Middleware używa Web Crypto — patrz `src/middleware.ts`.
 */

import { cookies } from 'next/headers';
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const PLANNING_COOKIE_NAME = 'planning_session';
export const PLANNING_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 godzin

function getSecret(): string {
  const secret = process.env.PLANNING_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'PLANNING_SESSION_SECRET musi być ustawione (min. 32 znaki). Wygeneruj: `openssl rand -hex 32`.'
    );
  }
  return secret;
}

function getExpectedPassword(): string {
  const password = process.env.PLANNING_PASSWORD;
  if (!password) {
    throw new Error('PLANNING_PASSWORD nie jest ustawione w środowisku.');
  }
  return password;
}

/**
 * Porównuje hasło użytkownika z env-em w sposób odporny na timing-attack.
 */
export function verifyPassword(input: string): boolean {
  const expected = getExpectedPassword();
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    // Stała operacja, żeby nie ujawniać długości
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Generuje token sesji: `<expiresAtMs>.<nonce>.<hmac>`.
 * Nonce zapobiega odgadnięciu tokena gdy ktoś zna zegar serwera i sekret.
 */
export function signSession(expiresAtMs: number): string {
  const nonce = randomBytes(8).toString('hex');
  const payload = `${expiresAtMs}.${nonce}`;
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Weryfikuje token sesji. Zwraca true jeśli HMAC poprawny i nie wygasł.
 */
export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresStr, nonce, hmacHex] = parts;
  const expiresAtMs = Number.parseInt(expiresStr, 10);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;
  if (!nonce || nonce.length === 0) return false;

  const payload = `${expiresStr}.${nonce}`;
  const expectedHmac = createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex');

  const a = Buffer.from(hmacHex, 'hex');
  const b = Buffer.from(expectedHmac, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/**
 * Czyta cookie sesji i waliduje. Używane w server actions.
 */
export async function isPlanningAuthorized(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PLANNING_COOKIE_NAME)?.value;
    return verifySession(token);
  } catch {
    return false;
  }
}

/**
 * Gate dla server actions piszących plany produkcji.
 * Zwraca obiekt błędu jeśli brak autoryzacji — wywołujący zwraca go do klienta.
 *
 * Wzorzec użycia:
 *   const gate = await requirePlanningAccess();
 *   if (gate) return gate;
 */
export async function requirePlanningAccess(): Promise<
  { success: false; error: string } | null
> {
  if (await isPlanningAuthorized()) return null;
  return {
    success: false,
    error: 'Brak dostępu. Zaloguj się ponownie (/planning/login).',
  };
}
