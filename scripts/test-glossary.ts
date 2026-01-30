import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { getGlossaryAiConstraints, listGlossaryTerms, listNegativePrompts } from '@/lib/glossary/repo';

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function main() {
  const prisma = new PrismaClient();
  const db = prisma as any;
  try {
    const adminEmail = `${makeId('admin')}@example.com`;
    const admin = await prisma.user.create({
      data: { email: adminEmail, passwordHash: 'x', role: 'member', isSystemAdmin: false }
    });

    const project = await prisma.project.create({
      data: {
        name: makeId('glossary-project'),
        sourceLocale: 'zh-CN'
      }
    });

    await prisma.projectMember.create({
      data: { projectId: project.id, userId: admin.id, role: 'admin', canReview: true }
    });

    await prisma.$transaction([
      prisma.projectLocale.upsert({
        where: { projectId_locale: { projectId: project.id, locale: 'en' } },
        update: {},
        create: { projectId: project.id, locale: 'en' }
      }),
      prisma.projectLocale.upsert({
        where: { projectId_locale: { projectId: project.id, locale: 'ja' } },
        update: {},
        create: { projectId: project.id, locale: 'ja' }
      })
    ]);

    const term1 = await db.projectGlossaryTerm.create({
      data: {
        projectId: project.id,
        locale: 'en',
        source: 'entry',
        target: '条目',
        type: 'forced',
        status: 'enabled',
        note: 'Must use entry',
        createdByUserId: admin.id,
        updatedByUserId: admin.id
      }
    });

    await db.projectGlossaryTerm.create({
      data: {
        projectId: project.id,
        locale: 'en',
        source: 'context',
        target: '语境',
        type: 'recommended',
        status: 'disabled',
        note: '',
        createdByUserId: admin.id,
        updatedByUserId: admin.id
      }
    });

    const negative1 = await db.projectNegativePrompt.create({
      data: {
        projectId: project.id,
        locale: 'en',
        phrase: 'cheap',
        alternative: 'cost-effective',
        note: 'avoid cheap tone',
        status: 'enabled',
        createdByUserId: admin.id,
        updatedByUserId: admin.id
      }
    });

    await db.projectNegativePrompt.create({
      data: {
        projectId: project.id,
        locale: 'en',
        phrase: 'unprofessional',
        alternative: null,
        note: '',
        status: 'disabled',
        createdByUserId: admin.id,
        updatedByUserId: admin.id
      }
    });

    await assert.rejects(
      () =>
        db.projectGlossaryTerm.create({
          data: {
            projectId: project.id,
            locale: 'en',
            source: term1.source,
            target: 'duplicate',
            type: 'recommended',
            status: 'enabled'
          }
        }),
      (err: any) => err?.code === 'P2002'
    );

    await assert.rejects(
      () =>
        db.projectNegativePrompt.create({
          data: {
            projectId: project.id,
            locale: 'en',
            phrase: negative1.phrase,
            status: 'enabled'
          }
        }),
      (err: any) => err?.code === 'P2002'
    );

    const listAll = await listGlossaryTerms(db, {
      projectId: project.id,
      locale: 'en',
      type: 'all',
      status: 'all',
      page: 1,
      pageSize: 20
    });
    assert.equal(listAll.total, 2);

    const listForced = await listGlossaryTerms(db, {
      projectId: project.id,
      locale: 'en',
      type: 'forced',
      status: 'all',
      page: 1,
      pageSize: 20
    });
    assert.equal(listForced.total, 1);
    assert.equal(listForced.items[0]?.source, 'entry');

    const listEnabledNegatives = await listNegativePrompts(db, {
      projectId: project.id,
      locale: 'en',
      status: 'enabled',
      page: 1,
      pageSize: 20
    });
    assert.equal(listEnabledNegatives.total, 1);
    assert.equal(listEnabledNegatives.items[0]?.phrase, 'cheap');

    const constraints = await getGlossaryAiConstraints(db, { projectId: project.id, locale: 'en' });
    assert.equal(constraints.terms.length, 1);
    assert.equal(constraints.negativePrompts.length, 1);

    console.log('glossary tests passed');
  } finally {
    await prisma.$disconnect();
  }
}

main();
