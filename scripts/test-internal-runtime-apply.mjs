import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(baseUrl, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      await wait(300);
    }
    await wait(300);
  }
  throw new Error(`Server not ready: ${baseUrl}`);
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Response is not JSON: ${text}`);
  }
}

async function runCmd(cwd, env, args) {
  const pnpmCommand = env.npm_execpath ? 'node' : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const pnpmArgsPrefix = env.npm_execpath ? [env.npm_execpath] : [];
  const child = spawn(pnpmCommand, [...pnpmArgsPrefix, ...args], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const out = [];
  child.stdout.on('data', (d) => out.push(String(d)));
  child.stderr.on('data', (d) => out.push(String(d)));
  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  if (exitCode !== 0) {
    throw new Error(`Command failed: pnpm ${args.join(' ')}\n\n${out.join('')}`);
  }
}

async function run() {
  const port = 3600 + Math.floor(Math.random() * 200);
  const baseUrl = `http://localhost:${port}`;

  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const sqlitePath = path.join(os.tmpdir(), `core_runtime_apply_${crypto.randomUUID()}.sqlite`);

  const sharedSecret = crypto.randomBytes(24).toString('hex');
  const env = {
    ...process.env,
    APP_ENV: 'dev',
    BASE_URL: baseUrl,
    AUTH_SECRET: crypto.randomBytes(32).toString('hex'),
    DATABASE_URL: `file:${sqlitePath}`,
    ENHANCED_CORE_SECRET: sharedSecret,
    PORT: String(port)
  };

  await runCmd(cwd, env, ['db:generate']);
  await runCmd(cwd, env, ['db:migrate']);
  await runCmd(cwd, env, ['db:seed']);

  fs.rmSync(path.join(cwd, '.next', 'dev', 'lock'), { force: true });

  const pnpmCommand = env.npm_execpath ? 'node' : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const pnpmArgsPrefix = env.npm_execpath ? [env.npm_execpath] : [];
  const server = spawn(pnpmCommand, [...pnpmArgsPrefix, 'dev', '--port', String(port)], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logs = [];
  server.stdout.on('data', (d) => logs.push(String(d)));
  server.stderr.on('data', (d) => logs.push(String(d)));

  try {
    await waitForServer(baseUrl);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${sqlitePath}`
        }
      }
    });

    const project = await prisma.project.findUnique({
      where: { name: 'Demo Project' },
      select: { id: true }
    });
    assert.ok(project?.id);

    const page = await prisma.page.findUnique({
      where: { projectId_route: { projectId: project.id, route: '/login' } },
      select: { id: true }
    });
    assert.ok(page?.id);

    const moduleRow = await prisma.module.findFirst({
      where: { pageId: page.id, name: 'LoginForm' },
      select: { id: true }
    });
    assert.ok(moduleRow?.id);

    const unauthorizedRes = await fetch(`${baseUrl}/api/internal/runtime/diff/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ applyId: crypto.randomUUID(), projectId: project.id, route: '/login', operations: [] })
    });
    assert.equal(unauthorizedRes.status, 401);

    const applyId = crypto.randomUUID();
    const op = {
      kind: 'unregistered',
      key: `test.${crypto.randomUUID().slice(0, 8)}`,
      sourceText: '登录',
      action: 'bind',
      targetPageId: page.id,
      targetModuleId: moduleRow.id
    };

    const applyRes = await fetch(`${baseUrl}/api/internal/runtime/diff/apply`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-core-secret': sharedSecret
      },
      body: JSON.stringify({ applyId, projectId: project.id, route: '/login', operations: [op] })
    });
    assert.equal(applyRes.status, 200);
    const applyJson = await readJson(applyRes);
    assert.equal(applyJson.ok, true);

    const entry = await prisma.entry.findUnique({
      where: { projectId_key: { projectId: project.id, key: op.key } },
      select: { id: true }
    });
    assert.ok(entry?.id);

    const placementCount1 = await prisma.entryPlacement.count({
      where: { entryId: entry.id, moduleId: moduleRow.id }
    });
    assert.equal(placementCount1, 1);

    const applyRes2 = await fetch(`${baseUrl}/api/internal/runtime/diff/apply`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-core-secret': sharedSecret
      },
      body: JSON.stringify({ applyId, projectId: project.id, route: '/login', operations: [op] })
    });
    assert.equal(applyRes2.status, 200);

    const placementCount2 = await prisma.entryPlacement.count({
      where: { entryId: entry.id, moduleId: moduleRow.id }
    });
    assert.equal(placementCount2, 1);
  } catch (err) {
    throw new Error(`${err?.stack || err}\n\nServer logs:\n${logs.join('')}`);
  } finally {
    server.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
