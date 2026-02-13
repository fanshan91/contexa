import { PrismaClient } from '@prisma/client';

function nowMs() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function formatMs(ms) {
  return `${ms}ms`;
}

function makeKeys(count) {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = `k${String(i).padStart(6, '0')}`;
  }
  return out;
}

function buildOrderedMap({ entries, templateSignatures }) {
  const valueByKey = new Map();
  for (const e of entries) valueByKey.set(e.key, e.sourceText);

  const orderedOutMap = {};
  const used = new Set();
  for (const signature of templateSignatures) {
    const value = valueByKey.get(signature);
    if (value === undefined) continue;
    orderedOutMap[signature] = value;
    used.add(signature);
  }
  for (const e of entries) {
    const value = valueByKey.get(e.key);
    if (value === undefined) continue;
    if (used.has(e.key)) continue;
    orderedOutMap[e.key] = value;
  }
  return orderedOutMap;
}

async function main() {
  const prisma = new PrismaClient();
  const size = Number(process.env.SIZE ?? '1000');
  const projectName = `__test_langpack_order_${Date.now()}`;

  const t0 = nowMs();
  const project = await prisma.project.create({
    data: {
      name: projectName,
      sourceLocale: 'en',
      description: 'test'
    },
    select: { id: true }
  });
  const projectId = project.id;

  const keys = makeKeys(size);
  const templateKeys = [...keys].reverse();

  await prisma.entry.createMany({
    data: keys.map((key) => ({
      projectId,
      key,
      sourceText: `v_${key}`,
      sourceLocale: 'en'
    }))
  });

  const templateRows = templateKeys.map((signature, position) => ({ projectId, signature, position }));
  for (let i = 0; i < templateRows.length; i += 1000) {
    await prisma.languagePackTemplateItem.createMany({ data: templateRows.slice(i, i + 1000) });
  }

  const t1 = nowMs();

  const entries = await prisma.entry.findMany({
    where: { projectId },
    orderBy: { key: 'asc' },
    select: { key: true, sourceText: true }
  });
  const templateSignatures = (
    await prisma.languagePackTemplateItem.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      select: { signature: true }
    })
  ).map((r) => r.signature);

  const t2 = nowMs();

  const out1 = buildOrderedMap({ entries, templateSignatures });
  const json1 = JSON.stringify(out1, null, 2);
  const out2 = buildOrderedMap({ entries, templateSignatures });
  const json2 = JSON.stringify(out2, null, 2);

  const t3 = nowMs();

  const head = Object.keys(out1).slice(0, 5);
  const expectedHead = templateKeys.slice(0, 5);
  const okHead = JSON.stringify(head) === JSON.stringify(expectedHead);
  const okStable = json1 === json2;

  console.log(`projectId=${projectId}`);
  console.log(`size=${size}`);
  console.log(`setup=${formatMs(t1 - t0)} query=${formatMs(t2 - t1)} build+stringify=${formatMs(t3 - t2)}`);
  console.log(`headOk=${okHead} stableOk=${okStable}`);
  console.log(`head=${head.join(',')}`);

  await prisma.entry.deleteMany({ where: { projectId } });
  await prisma.languagePackTemplateItem.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.$disconnect();

  if (!okHead) process.exitCode = 1;
  if (!okStable) process.exitCode = 1;
}

await main();

