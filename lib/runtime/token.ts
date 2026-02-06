import 'server-only';

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

const ENCRYPTION_ALG = 'aes-256-gcm';
const ENCRYPTION_IV_BYTES = 12;

function getEncryptionKey() {
  return createHash('sha256').update(env.AUTH_SECRET).digest();
}

export function generateRuntimeToken() {
  return randomBytes(32).toString('base64url');
}

export function hashRuntimeToken(token: string) {
  return createHmac('sha256', env.AUTH_SECRET).update(token).digest('base64url');
}

export function encryptRuntimeToken(token: string) {
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALG, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join('.');
}

export function decryptRuntimeToken(payload: string) {
  const [ivText, cipherText, tagText] = payload.split('.');
  if (!ivText || !cipherText || !tagText) {
    throw new Error('Invalid encrypted runtime token');
  }
  const iv = Buffer.from(ivText, 'base64url');
  const ciphertext = Buffer.from(cipherText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  const decipher = createDecipheriv(ENCRYPTION_ALG, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

