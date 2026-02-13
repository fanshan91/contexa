import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const entryPlacements = await prisma.entryPlacement.deleteMany({});
  const translations = await prisma.translation.deleteMany({});
  const packageUploads = await prisma.packageUpload.deleteMany({});
  const entries = await prisma.entry.deleteMany({});
  const templateItems = await prisma.languagePackTemplateItem.deleteMany({});
  const templateMeta = await prisma.systemMeta.deleteMany({
    where: { key: { contains: ':langpack:' } }
  });

  console.log(
    JSON.stringify(
      {
        deleted: {
          entryPlacements: entryPlacements.count,
          translations: translations.count,
          packageUploads: packageUploads.count,
          entries: entries.count,
          languagePackTemplateItem: templateItems.count,
          systemMetaLangpack: templateMeta.count
        }
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

await main();

