export type GlossaryListParams = {
  projectId: number;
  locale: string;
  query?: string;
  type?: 'all' | 'recommended' | 'forced';
  status?: 'all' | 'enabled' | 'disabled';
  page?: number;
  pageSize?: number;
};

export type GlossaryTermListItem = {
  id: number;
  source: string;
  target: string;
  type: 'recommended' | 'forced';
  status: 'enabled' | 'disabled';
  note: string;
  updatedAt: string;
  updatedBy: string;
};

export type GlossaryListResult = {
  items: GlossaryTermListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type NegativePromptListParams = {
  projectId: number;
  locale: string;
  query?: string;
  status?: 'all' | 'enabled' | 'disabled';
  page?: number;
  pageSize?: number;
};

export type NegativePromptListItem = {
  id: number;
  phrase: string;
  alternative: string;
  note: string;
  status: 'enabled' | 'disabled';
  updatedAt: string;
  updatedBy: string;
};

export type NegativePromptListResult = {
  items: NegativePromptListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type GlossaryAiConstraints = {
  locale: string;
  terms: Array<{ source: string; target: string; type: 'recommended' | 'forced' }>;
  negativePrompts: Array<{ phrase: string; alternative: string }>;
};

function toUserLabel(user: { name: string | null; email: string } | null) {
  return user?.name?.trim() ? user.name.trim() : user?.email ?? '—';
}

export async function listGlossaryTerms(db: any, input: GlossaryListParams) {
  const where: Record<string, any> = {
    projectId: input.projectId,
    locale: input.locale
  };

  if (input.type && input.type !== 'all') where.type = input.type;
  if (input.status && input.status !== 'all') where.status = input.status;
  if (input.query) {
    where.OR = [
      { source: { contains: input.query } },
      { target: { contains: input.query } },
      { note: { contains: input.query } }
    ];
  }

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.projectGlossaryTerm.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { updatedBy: { select: { name: true, email: true } } }
    }),
    db.projectGlossaryTerm.count({ where })
  ]);

  return {
    items: items.map((it: any) => ({
      id: it.id,
      source: it.source,
      target: it.target,
      type: it.type,
      status: it.status,
      note: it.note ?? '',
      updatedAt: it.updatedAt.toISOString(),
      updatedBy: toUserLabel(it.updatedBy)
    })),
    total,
    page,
    pageSize
  } satisfies GlossaryListResult;
}

export async function listNegativePrompts(db: any, input: NegativePromptListParams) {
  const where: Record<string, any> = {
    projectId: input.projectId,
    locale: input.locale
  };

  if (input.status && input.status !== 'all') where.status = input.status;
  if (input.query) {
    where.OR = [
      { phrase: { contains: input.query } },
      { alternative: { contains: input.query } },
      { note: { contains: input.query } }
    ];
  }

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.projectNegativePrompt.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { updatedBy: { select: { name: true, email: true } } }
    }),
    db.projectNegativePrompt.count({ where })
  ]);

  return {
    items: items.map((it: any) => ({
      id: it.id,
      phrase: it.phrase,
      alternative: it.alternative ?? '',
      note: it.note ?? '',
      status: it.status,
      updatedAt: it.updatedAt.toISOString(),
      updatedBy: toUserLabel(it.updatedBy)
    })),
    total,
    page,
    pageSize
  } satisfies NegativePromptListResult;
}

export async function getGlossaryAiConstraints(db: any, input: { projectId: number; locale: string }) {
  const [terms, negatives] = await Promise.all([
    db.projectGlossaryTerm.findMany({
      where: { projectId: input.projectId, locale: input.locale, status: 'enabled' },
      orderBy: [{ type: 'desc' }, { updatedAt: 'desc' }],
      select: { source: true, target: true, type: true }
    }),
    db.projectNegativePrompt.findMany({
      where: { projectId: input.projectId, locale: input.locale, status: 'enabled' },
      orderBy: { updatedAt: 'desc' },
      select: { phrase: true, alternative: true }
    })
  ]);

  return {
    locale: input.locale,
    terms: terms.map((t: any) => ({ source: t.source, target: t.target, type: t.type })),
    negativePrompts: negatives.map((n: any) => ({ phrase: n.phrase, alternative: n.alternative ?? '' }))
  } satisfies GlossaryAiConstraints;
}

