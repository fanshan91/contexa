import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { parseLanguagePack } from '@/lib/packages/language-pack-parser';
import { importSourcePack, importTargetPack } from '@/lib/packages/repo';

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const project = await prisma.project.create({
      data: { name: makeId('lp-project'), sourceLocale: 'zh-CN' }
    });

    await prisma.$transaction([
      prisma.projectLocale.create({ data: { projectId: project.id, locale: 'zh-CN' } }),
      prisma.projectLocale.create({ data: { projectId: project.id, locale: 'en-US' } })
    ]);

    const sourceRaw = JSON.stringify({ a: { b: '你好' }, c: '再见' });
    const parsedSource = parseLanguagePack(sourceRaw);
    assert.equal(parsedSource.ok, true);
    assert.equal(parsedSource.ok && parsedSource.data.shape, 'tree');
    assert.equal(parsedSource.ok && parsedSource.data.drafts.length, 2);

    const firstImport = await importSourcePack(prisma, {
      projectId: project.id,
      sourceLocale: 'zh-CN',
      targetLocales: ['en-US'],
      drafts: parsedSource.ok ? parsedSource.data.drafts : []
    });
    assert.equal(firstImport.added, 2);
    assert.equal(firstImport.updated, 0);

    const entries = await prisma.entry.findMany({
      where: { projectId: project.id },
      orderBy: { key: 'asc' },
      select: { id: true, key: true, sourceText: true }
    });
    assert.deepEqual(
      entries.map((e) => e.key),
      ['a.b', 'c']
    );

    const translations = await prisma.translation.findMany({
      where: { projectId: project.id, locale: 'en-US' },
      select: { entryId: true, text: true, status: true }
    });
    assert.equal(translations.length, 2);
    assert.equal(translations.every((t) => t.status === 'pending'), true);

    const entryAB = entries.find((e) => e.key === 'a.b');
    assert.ok(entryAB);
    await prisma.translation.update({
      where: { entryId_locale: { entryId: entryAB.id, locale: 'en-US' } },
      data: { text: 'Hello', status: 'approved' }
    });

    const sourceRaw2 = JSON.stringify({ a: { b: '你好呀' }, c: '再见' });
    const parsedSource2 = parseLanguagePack(sourceRaw2);
    assert.equal(parsedSource2.ok, true);
    const secondImport = await importSourcePack(prisma, {
      projectId: project.id,
      sourceLocale: 'zh-CN',
      targetLocales: ['en-US'],
      drafts: parsedSource2.ok ? parsedSource2.data.drafts : []
    });
    assert.equal(secondImport.added, 0);
    assert.equal(secondImport.updated, 1);
    assert.equal(secondImport.markedNeedsUpdate >= 1, true);

    const trABAfterSourceUpdate = await prisma.translation.findUnique({
      where: { entryId_locale: { entryId: entryAB.id, locale: 'en-US' } },
      select: { status: true }
    });
    assert.equal(trABAfterSourceUpdate?.status, 'needs_update');

    const targetRaw = JSON.stringify({ 'a.b': 'Hi', missing: 'X', c: '' });
    const parsedTarget = parseLanguagePack(targetRaw);
    assert.equal(parsedTarget.ok, true);

    const targetImport = await importTargetPack(prisma, {
      projectId: project.id,
      locale: 'en-US',
      drafts: parsedTarget.ok ? parsedTarget.data.drafts : []
    });
    assert.equal(targetImport.updated, 1);
    assert.equal(targetImport.ignored, 1);
    assert.equal(targetImport.skippedEmpty, 1);

    const trABAfterTargetImport = await prisma.translation.findUnique({
      where: { entryId_locale: { entryId: entryAB.id, locale: 'en-US' } },
      select: { text: true, status: true }
    });
    assert.equal(trABAfterTargetImport?.text, 'Hi');
    assert.equal(trABAfterTargetImport?.status, 'needs_review');

    console.log('language pack import tests passed');
  } finally {
    await prisma.$disconnect();
  }
}

main();

