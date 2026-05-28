'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  PLANNING_COOKIE_NAME,
  PLANNING_SESSION_DURATION_MS,
  signSession,
  verifyPassword,
} from '@/lib/auth';

/**
 * Server action wywoływany z formularza /planning/login.
 * Po sukcesie ustawia HMAC-podpisane cookie sesji i przekierowuje na /planning.
 * Po błędzie wraca do /planning/login z parametrem ?error=invalid.
 */
export async function loginPlanning(formData: FormData) {
  const password = String(formData.get('password') ?? '');

  if (!password || !verifyPassword(password)) {
    redirect('/planning/login?error=invalid');
  }

  const expiresAt = Date.now() + PLANNING_SESSION_DURATION_MS;
  const token = signSession(expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(PLANNING_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(PLANNING_SESSION_DURATION_MS / 1000),
    path: '/',
  });

  redirect('/planning');
}

/**
 * Wylogowanie — czyści cookie sesji, wraca na monitor.
 */
export async function logoutPlanning() {
  const cookieStore = await cookies();
  cookieStore.delete(PLANNING_COOKIE_NAME);
  redirect('/');
}
