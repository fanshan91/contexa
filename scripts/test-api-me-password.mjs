import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

import dotenv from 'dotenv';
import { SignJWT } from 'jose';
import { hash as bcryptHash, compare as bcryptCompare } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(baseUrl, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/sign-in`, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      await wait(300);
    }
    await wait(300);
  }
  throw new Error(`Server not ready: ${baseUrl}`);
}

async function signSessionToken({ userId, expiresIso }) {
  const secret = process.env.AUTH_SECRET;
  assert.ok(secret && secret.length >= 16, 'AUTH_SECRET is required');
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({
    user: { id: userId },
    expires: expiresIso
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1 day from now')
    .sign(key);
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Response is not JSON: ${text}`);
  }
}

async function run() {
  const port = 3100 + Math.floor(Math.random() * 100);
  const baseUrl = `http://localhost:${port}`;

  const server = spawn(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['dev', '--port', String(port)],
    {
      cwd: new URL('../', import.meta.url).pathname,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  const logs = [];
  server.stdout.on('data', (d) => logs.push(String(d)));
  server.stderr.on('data', (d) => logs.push(String(d)));

  const prisma = new PrismaClient();
  const email = `test_${crypto.randomUUID().slice(0, 8)}`;
  const initialPassword = 'oldpass1';
  const newPassword = 'newpass1';

  let userId = null;

  try {
    await waitForServer(baseUrl);

    const created = await prisma.user.create({
      data: {
        email,
        name: 'Test',
        passwordHash: await bcryptHash(initialPassword, 10),
        role: 'owner',
        isSystemAdmin: false
      },
      select: { id: true }
    });
    userId = created.id;

    {
      const res = await fetch(`${baseUrl}/api/me/password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword,
          confirmPassword: newPassword
        })
      });
      assert.equal(res.status, 401);
      const json = await readJson(res);
      assert.equal(json.ok, false);
    }

    const token = await signSessionToken({
      userId,
      expiresIso: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    {
      const res = await fetch(`${baseUrl}/api/me/password`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `session=${encodeURIComponent(token)}`
        },
        body: JSON.stringify({
          currentPassword: 'wrongpass1',
          newPassword,
          confirmPassword: newPassword
        })
      });
      assert.equal(res.status, 400);
      const json = await readJson(res);
      assert.equal(json.ok, false);
      assert.ok(
        json.error?.fieldErrors?.currentPassword?.length,
        'Expected currentPassword field error'
      );
    }

    {
      const res = await fetch(`${baseUrl}/api/me/password`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `session=${encodeURIComponent(token)}`
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword,
          confirmPassword: newPassword
        })
      });
      assert.equal(res.status, 200);
      const json = await readJson(res);
      assert.equal(json.ok, true);
      assert.equal(json.data?.success, true);
    }

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true }
    });
    assert.equal(await bcryptCompare(newPassword, updated.passwordHash), true);
    assert.equal(
      await bcryptCompare(initialPassword, updated.passwordHash),
      false
    );
  } catch (err) {
    const output = logs.join('');
    throw new Error(`${err?.stack || err}\n\nServer logs:\n${output}`);
  } finally {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }
    await prisma.$disconnect();
    server.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
