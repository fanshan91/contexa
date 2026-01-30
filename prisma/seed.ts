import crypto from 'node:crypto';

import * as Prisma from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new (Prisma as any).PrismaClient();

async function main() {
  const instanceId = crypto.randomUUID();

  await prisma.systemMeta.upsert({
    where: { key: 'instance_id' },
    update: {},
    create: {
      key: 'instance_id',
      value: instanceId,
      description: 'Core instance id'
    }
  });

  const adminEmail = 'admin';
  const adminPasswordHash = await hash('admin@contexa', 10);

  const legacyAdmin = await prisma.user.findUnique({
    where: { email: 'admin@contexa.local' }
  });
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  const admin = legacyAdmin
    ? await prisma.user.update({
        where: { id: legacyAdmin.id },
        data: {
          email: existingAdmin ? legacyAdmin.email : adminEmail,
          name: 'Admin',
          passwordHash: adminPasswordHash,
          isSystemAdmin: true,
          role: 'owner',
          deletedAt: null
        }
      })
    : await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
          name: 'Admin',
          passwordHash: adminPasswordHash,
          isSystemAdmin: true,
          role: 'owner',
          deletedAt: null
        },
        create: {
          email: adminEmail,
          name: 'Admin',
          passwordHash: adminPasswordHash,
          role: 'owner',
          isSystemAdmin: true
        }
      });

  let team = await prisma.team.findFirst({ where: { name: 'Default Team' } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Default Team',
        planName: 'Free',
        subscriptionStatus: 'active'
      }
    });
  }

  const existingTeamMember = await prisma.teamMember.findFirst({
    where: { userId: admin.id, teamId: team.id }
  });
  if (!existingTeamMember) {
    await prisma.teamMember.create({
      data: {
        userId: admin.id,
        teamId: team.id,
        role: 'owner'
      }
    });
  }

  const project = await prisma.project.upsert({
    where: { name: 'Demo Project' },
    update: {},
    create: {
      name: 'Demo Project',
      createdByUserId: admin.id,
      sourceLocale: 'zh-CN',
      description: 'Seeded demo project',
      translationAdapter: 'tbd'
    }
  });

  await prisma.projectLocale.upsert({
    where: { projectId_locale: { projectId: project.id, locale: 'zh-CN' } },
    update: {},
    create: {
      projectId: project.id,
      locale: 'zh-CN'
    }
  });

  await prisma.projectLocale.upsert({
    where: { projectId_locale: { projectId: project.id, locale: 'en-US' } },
    update: {},
    create: {
      projectId: project.id,
      locale: 'en-US'
    }
  });

  const page = await prisma.page.upsert({
    where: { projectId_route: { projectId: project.id, route: '/login' } },
    update: { title: 'Login' },
    create: {
      projectId: project.id,
      route: '/login',
      title: 'Login'
    }
  });

  let module = await prisma.module.findFirst({
    where: { pageId: page.id, name: 'LoginForm' }
  });
  if (!module) {
    module = await prisma.module.create({
      data: {
        pageId: page.id,
        name: 'LoginForm'
      }
    });
  }

  const entry = await prisma.entry.upsert({
    where: { projectId_key: { projectId: project.id, key: 'auth.sign_in' } },
    update: { sourceText: '登录', sourceLocale: 'zh-CN' },
    create: {
      projectId: project.id,
      key: 'auth.sign_in',
      sourceText: '登录',
      sourceLocale: 'zh-CN'
    }
  });

  await prisma.translation.upsert({
    where: { entryId_locale: { entryId: entry.id, locale: 'en-US' } },
    update: { text: 'Sign in', status: 'approved' },
    create: {
      entryId: entry.id,
      projectId: project.id,
      locale: 'en-US',
      text: 'Sign in',
      status: 'approved'
    }
  });

  await prisma.entryPlacement.upsert({
    where: {
      entryId_pageId_moduleId: {
        entryId: entry.id,
        pageId: page.id,
        moduleId: module.id
      }
    },
    update: {},
    create: {
      entryId: entry.id,
      pageId: page.id,
      moduleId: module.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
