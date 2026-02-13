import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

const projectId = Number(process.env.PROJECT_ID || 1);
const envSqlitePath = process.env.SQLITE_PATH || './sqlite.db';
const authSecret = process.env.AUTH_SECRET;

if (!authSecret) {
  console.error('Missing AUTH_SECRET in .env');
  process.exit(1);
}

const token = crypto.randomBytes(32).toString('base64url');
const tokenHash = crypto.createHmac('sha256', authSecret).update(token).digest('base64url');

const key = crypto.createHash('sha256').update(authSecret).digest();
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const tokenEnc = [iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join('.');

const now = new Date();
const expiresAt = new Date(now);
expiresAt.setMonth(expiresAt.getMonth() + 6);

const prismaSqlitePath = path.join(here, '..', 'prisma', 'sqlite.db');
const sqlitePath = prismaSqlitePath;
const db = new Database(path.isAbsolute(sqlitePath) ? sqlitePath : path.join(here, '..', envSqlitePath));
try {
  const stmt = db.prepare(
    'INSERT INTO \"ProjectRuntimeToken\" (\"projectId\",\"tokenEnc\",\"tokenHash\",\"enabled\",\"expiresAt\",\"createdAt\",\"rotatedAt\",\"updatedAt\") VALUES (@projectId,@tokenEnc,@tokenHash,1,@expiresAt,@now,@now,@now) ON CONFLICT(\"projectId\") DO UPDATE SET \"tokenEnc\"=excluded.\"tokenEnc\",\"tokenHash\"=excluded.\"tokenHash\",\"enabled\"=1,\"expiresAt\"=excluded.\"expiresAt\",\"rotatedAt\"=excluded.\"rotatedAt\",\"updatedAt\"=excluded.\"updatedAt\"'
  );
  stmt.run({
    projectId,
    tokenEnc,
    tokenHash,
    now: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });
} finally {
  db.close();
}

process.stdout.write(JSON.stringify({ projectId, token }) + '\n');
