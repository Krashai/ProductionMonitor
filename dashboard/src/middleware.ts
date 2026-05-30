/**
 * Middleware — zabezpieczenie tras /planning hasłem.
 *
 * Działa w edge runtime, więc używa Web Crypto API zamiast node:crypto.
 * Logika musi pozostać równoważna z `src/lib/auth.ts#verifySession`.
 */

import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'planning_session';
const LOGIN_PATH = '/planning/login';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strona logowania zawsze dostępna
  if (pathname === LOGIN_PATH) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await verifySessionEdge(token);
  if (valid) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Wszystko pod /planning, włącznie z /planning/login (które wczesnie wraca next())
  matcher: ['/planning/:path*'],
};

async function verifySessionEdge(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.PLANNING_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresStr, nonce, hmacHex] = parts;
  const expiresAtMs = Number.parseInt(expiresStr, 10);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;
  if (!nonce || nonce.length === 0) return false;
  if (!/^[0-9a-f]+$/i.test(hmacHex)) return false;

  const payload = `${expiresStr}.${nonce}`;
  const enc = new TextEncoder();
  const secretBytes = enc.encode(secret) as unknown as BufferSource;
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const hmacBytes = hexToBytes(hmacHex);
  if (hmacBytes.length === 0) return false;

  return crypto.subtle.verify(
    'HMAC',
    key,
    hmacBytes as unknown as BufferSource,
    enc.encode(payload) as unknown as BufferSource
  );
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return new Uint8Array(0);
    out[i] = byte;
  }
  return out;
}
