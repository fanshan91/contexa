import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

const key = new TextEncoder().encode(env.AUTH_SECRET);
const SALT_ROUNDS = 10;
const DEFAULT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const EXTENDED_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string) {
  return hash(password, SALT_ROUNDS);
}

export async function comparePasswords(
  plainTextPassword: string,
  hashedPassword: string
) {
  return compare(plainTextPassword, hashedPassword);
}

export type SessionData = {
  user: { id: number };
  expires: string;
};

export async function signToken(
  payload: SessionData,
  maxAgeMs: number = DEFAULT_SESSION_MAX_AGE_MS
) {
  const maxAgeSeconds = Math.floor(maxAgeMs / 1000);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds} seconds from now`)
    .sign(key);
}

export async function verifyToken(input: string) {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  });
  return payload as SessionData;
}

export async function getSession() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return null;
  return await verifyToken(session);
}

export async function setSession(
  user: { id: number },
  options?: { rememberMe?: boolean }
) {
  const maxAgeMs = options?.rememberMe
    ? EXTENDED_SESSION_MAX_AGE_MS
    : DEFAULT_SESSION_MAX_AGE_MS;
  const expiresAt = new Date(Date.now() + maxAgeMs);
  const session: SessionData = {
    user: { id: user.id },
    expires: expiresAt.toISOString(),
  };
  const encryptedSession = await signToken(session, maxAgeMs);
  (await cookies()).set('session', encryptedSession, {
    path: '/',
    expires: expiresAt,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return session;
}
