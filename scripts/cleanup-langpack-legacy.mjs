import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const templateMeta = await prisma.systemMeta.deleteMany({
    where: { key: { contains: ':langpack:template' } }
  });
  const shapeMeta = await prisma.systemMeta.deleteMany({
    where: { key: { contains: ':langpack:shape' } }
  });
  const templateItems = await prisma.languagePackTemplateItem.deleteMany({});

  console.log(
    JSON.stringify(
      {
        deleted: {
          systemMetaTemplate: templateMeta.count,
          systemMetaShape: shapeMeta.count,
          languagePackTemplateItem: templateItems.count
        }
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

await main();

