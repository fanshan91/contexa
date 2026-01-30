import type { PrismaClient, TranslationStatus } from '@prisma/client';
import type { EntryDraft } from './language-pack-parser';

export type SourceImportSummary = {
  added: number;
  updated: number;
  markedNeedsUpdate: number;
};

export type TargetImportSummary = {
  updated: number;
  ignored: number;
  skippedEmpty: number;
};

function uniq<T>(list: T[]) {
  return Array.from(new Set(list));
}

function isMeaningful(text: string | null | undefined) {
  return Boolean(text && text.trim().length > 0);
}

async function runChunks<T, R>(
  items: T[],
  chunkSize: number,
  run: (chunk: T[]) => Promise<R>
) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(await run(items.slice(i, i + chunkSize)));
  }
  return out;
}

export async function importSourcePack(
  db: PrismaClient,
  {
    projectId,
    sourceLocale,
    targetLocales,
    drafts
  }: {
    projectId: number;
    sourceLocale: string;
    targetLocales: string[];
    drafts: EntryDraft[];
  }
): Promise<SourceImportSummary> {
  const safeDrafts = drafts
    .map((d) => ({ ...d, key: d.key.trim() }))
    .filter((d) => d.key.length > 0);
  const keys = uniq(safeDrafts.map((d) => d.key));
  if (keys.length === 0) return { added: 0, updated: 0, markedNeedsUpdate: 0 };

  const existing = await db.entry.findMany({
    where: { projectId, key: { in: keys } },
    select: { id: true, key: true, sourceText: true }
  });

  const existingByKey = new Map(existing.map((e) => [e.key, e] as const));
  const incomingByKey = new Map(safeDrafts.map((d) => [d.key, d.value] as const));

  const toCreate = keys
    .filter((k) => !existingByKey.has(k))
    .map((key) => ({ key, sourceText: incomingByKey.get(key) ?? '' }));

  const toUpdate = existing
    .map((e) => {
      const next = incomingByKey.get(e.key);
      if (typeof next !== 'string') return null;
      if (e.sourceText === next) return null;
      return { id: e.id, key: e.key, nextSourceText: next };
    })
    .filter(Boolean) as Array<{ id: number; key: string; nextSourceText: string }>;

  const normalizedTargetLocales = uniq(
    targetLocales.map((l) => l.trim()).filter((l) => l.length > 0 && l !== sourceLocale)
  );

  const result = await db.$transaction(async (tx) => {
    if (toCreate.length) {
      await tx.entry.createMany({
        data: toCreate.map((it) => ({
          projectId,
          key: it.key,
          sourceText: it.sourceText,
          sourceLocale
        }))
      });
    }

    if (toUpdate.length) {
      await runChunks(toUpdate, 100, async (chunk) => {
        await Promise.all(
          chunk.map((u) =>
            tx.entry.update({
              where: { id: u.id },
              data: { sourceText: u.nextSourceText }
            })
          )
        );
      });
    }

    const createdEntries = toCreate.length
      ? await tx.entry.findMany({
          where: { projectId, key: { in: toCreate.map((c) => c.key) } },
          select: { id: true }
        })
      : [];

    if (normalizedTargetLocales.length && createdEntries.length) {
      const rows = createdEntries.flatMap((e) =>
        normalizedTargetLocales.map((locale) => ({
          entryId: e.id,
          projectId,
          locale,
          text: null,
          status: 'pending' as TranslationStatus
        }))
      );

      await runChunks(rows, 500, async (chunk) => {
        await tx.translation.createMany({ data: chunk });
      });
    }

    let markedNeedsUpdate = 0;
    if (toUpdate.length) {
      const updatedEntryIds = toUpdate.map((u) => u.id);
      const updatedByEntry = await tx.translation.updateMany({
        where: {
          projectId,
          entryId: { in: updatedEntryIds },
          locale: { in: normalizedTargetLocales },
          status: { not: 'needs_update' },
          NOT: [{ text: null }, { text: '' }]
        },
        data: { status: 'needs_update' }
      });
      markedNeedsUpdate = updatedByEntry.count;
    }

    return {
      added: toCreate.length,
      updated: toUpdate.length,
      markedNeedsUpdate
    } satisfies SourceImportSummary;
  });

  return result;
}

export async function importTargetPack(
  db: PrismaClient,
  {
    projectId,
    locale,
    drafts
  }: {
    projectId: number;
    locale: string;
    drafts: EntryDraft[];
  }
): Promise<TargetImportSummary> {
  const safeDrafts = drafts
    .map((d) => ({ ...d, key: d.key.trim(), value: d.value }))
    .filter((d) => d.key.length > 0);

  const keys = uniq(safeDrafts.map((d) => d.key));
  if (keys.length === 0) return { updated: 0, ignored: 0, skippedEmpty: 0 };

  const entries = await db.entry.findMany({
    where: { projectId, key: { in: keys } },
    select: { id: true, key: true }
  });
  const entryIdByKey = new Map(entries.map((e) => [e.key, e.id] as const));

  const ignoredKeys = safeDrafts.filter((d) => !entryIdByKey.has(d.key)).map((d) => d.key);

  const updates = safeDrafts
    .map((d) => {
      const entryId = entryIdByKey.get(d.key);
      if (!entryId) return null;
      if (!isMeaningful(d.value)) return { entryId, text: null, skip: true as const };
      return { entryId, text: d.value, skip: false as const };
    })
    .filter(Boolean) as Array<{ entryId: number; text: string | null; skip: boolean }>;

  const skippedEmpty = updates.filter((u) => u.skip).length;
  const actionable = updates.filter((u) => !u.skip) as Array<{ entryId: number; text: string }>;

  const updated = await db.$transaction(async (tx) => {
    if (actionable.length === 0) return 0;

    await runChunks(actionable, 100, async (chunk) => {
      await Promise.all(
        chunk.map((u) =>
          tx.translation.upsert({
            where: { entryId_locale: { entryId: u.entryId, locale } },
            update: { text: u.text, status: 'needs_review' },
            create: { entryId: u.entryId, projectId, locale, text: u.text, status: 'needs_review' }
          })
        )
      );
    });

    return actionable.length;
  });

  return { updated, ignored: ignoredKeys.length, skippedEmpty };
}
