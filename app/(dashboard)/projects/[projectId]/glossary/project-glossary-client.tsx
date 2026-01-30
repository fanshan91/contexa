'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-primitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, type TableColumn } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { RadioGroup } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { TargetLocaleSelect } from '@/components/target-locale-select';
import { cn } from '@/lib/utils';
import {
  createGlossaryTermAction,
  createNegativePromptAction,
  deleteGlossaryTermsAction,
  deleteNegativePromptsAction,
  listGlossaryTermsQuery,
  listNegativePromptsQuery,
  toggleGlossaryTermStatusAction,
  toggleNegativePromptStatusAction,
  updateGlossaryTermAction,
  updateNegativePromptAction,
  type GlossaryListResult,
  type GlossaryTermListItem,
  type NegativePromptListItem,
  type NegativePromptListResult
} from './actions';

type GlossaryType = 'recommended' | 'forced';
type GlossaryStatus = 'enabled' | 'disabled';

type FilterType = 'all' | GlossaryType;
type FilterStatus = 'all' | GlossaryStatus;

function formatUpdatedAt(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(undefined, { hour12: false });
}

export function ProjectGlossaryClient({
  projectId,
  targetLocales,
  canManage,
  initialLocale,
  initialTerms,
  initialNegatives,
  bootstrapError
}: {
  projectId: number;
  targetLocales: string[];
  canManage: boolean;
  initialLocale: string;
  initialTerms: GlossaryListResult;
  initialNegatives: NegativePromptListResult;
  bootstrapError: string;
}) {
  const t = useTranslations('projectGlossary');
  const { push } = useToast();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<'terms' | 'negative'>('terms');
  const [locale, setLocale] = useState<string>(initialLocale);
  const [query, setQuery] = useState('');

  const [termType, setTermType] = useState<FilterType>('all');
  const [termStatus, setTermStatus] = useState<FilterStatus>('all');
  const [negativeStatus, setNegativeStatus] = useState<FilterStatus>('all');

  const [terms, setTerms] = useState<GlossaryListResult>(initialTerms);
  const [negatives, setNegatives] = useState<NegativePromptListResult>(initialNegatives);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>(bootstrapError);
  const listFetchSeq = useRef(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [termForm, setTermForm] = useState({
    source: '',
    target: '',
    type: 'recommended' as GlossaryType,
    status: 'enabled' as GlossaryStatus,
    note: ''
  });

  const [negativeForm, setNegativeForm] = useState({
    phrase: '',
    alternative: '',
    status: 'enabled' as GlossaryStatus,
    note: ''
  });

  const [formError, setFormError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<number[]>([]);

  const pageCount = useMemo(() => {
    const total = tab === 'terms' ? terms.total : negatives.total;
    const size = tab === 'terms' ? terms.pageSize : negatives.pageSize;
    return Math.max(1, Math.ceil(total / size));
  }, [negatives.pageSize, negatives.total, tab, terms.pageSize, terms.total]);

  useEffect(() => {
    if (!locale) return;

    const timer = window.setTimeout(() => {
      const seq = ++listFetchSeq.current;
      setLoading(true);
      setError('');

      (async () => {
        try {
          if (tab === 'terms') {
            const res = await listGlossaryTermsQuery({
              projectId,
              locale,
              query,
              type: termType,
              status: termStatus,
              page: terms.page,
              pageSize: terms.pageSize
            });
            if (listFetchSeq.current !== seq) return;
            if (res.ok) setTerms(res.data);
            else setError(res.error);
            return;
          }

          const res = await listNegativePromptsQuery({
            projectId,
            locale,
            query,
            status: negativeStatus,
            page: negatives.page,
            pageSize: negatives.pageSize
          });
          if (listFetchSeq.current !== seq) return;
          if (res.ok) setNegatives(res.data);
          else setError(res.error);
        } finally {
          if (listFetchSeq.current === seq) setLoading(false);
        }
      })();
    }, 240);

    return () => window.clearTimeout(timer);
  }, [
    locale,
    negativeStatus,
    negatives.page,
    negatives.pageSize,
    projectId,
    query,
    tab,
    termStatus,
    termType,
    terms.page,
    terms.pageSize
  ]);

  useEffect(() => {
    setFormError('');
  }, [tab, locale]);

  const viewItems = tab === 'terms' ? terms.items : negatives.items;
  const showEmpty = !error && viewItems.length === 0;

  const renderNote = (note?: string | null) =>
    note ? (
      <details className="group">
        <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground">
          <span className="line-clamp-2">{note}</span>
          <span className="mt-1 inline-flex text-xs text-muted-foreground group-open:hidden">
            {t('expand')}
          </span>
          <span className="mt-1 hidden text-xs text-muted-foreground group-open:inline-flex">
            {t('collapse')}
          </span>
        </summary>
      </details>
    ) : (
      <span className="text-muted-foreground">{t('empty')}</span>
    );

  const termColumns = useMemo<Array<TableColumn<GlossaryTermListItem>>>(
    () => [
      {
        key: 'source',
        title: t('colSource'),
        dataIndex: 'source',
        headerClassName: 'pr-4',
        cellClassName: 'py-3 pr-4 font-medium text-foreground align-top'
      },
      {
        key: 'target',
        title: t('colTarget'),
        dataIndex: 'target',
        headerClassName: 'pr-4',
        cellClassName: 'py-3 pr-4 text-muted-foreground align-top'
      },
      {
        key: 'type',
        title: t('colType'),
        dataIndex: 'type',
        headerClassName: 'pr-4 whitespace-nowrap',
        cellClassName: 'py-3 pr-4 align-top',
        render: (value: unknown) => (
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
              value === 'forced'
                ? 'bg-warning/15 text-warning'
                : 'bg-secondary text-secondary-foreground'
            )}
          >
            {value === 'forced' ? t('typeForced') : t('typeRecommended')}
          </span>
        )
      },
      {
        key: 'status',
        title: t('colStatus'),
        dataIndex: 'status',
        headerClassName: 'pr-4 whitespace-nowrap',
        cellClassName: 'py-3 pr-4 align-top',
        render: (value: unknown) => (
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
              value === 'enabled' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            )}
          >
            {value === 'enabled' ? t('statusEnabled') : t('statusDisabled')}
          </span>
        )
      },
      {
        key: 'note',
        title: t('colNote'),
        dataIndex: 'note',
        headerClassName: 'pr-4',
        cellClassName: 'py-3 pr-4 align-top',
        render: (value: unknown) => renderNote(value as string | null | undefined)
      },
      {
        key: 'updatedAt',
        title: t('colUpdatedAt'),
        dataIndex: 'updatedAt',
        headerClassName: 'pr-4 whitespace-nowrap',
        cellClassName: 'py-3 pr-4 whitespace-nowrap text-muted-foreground align-top',
        render: (value: unknown, record: GlossaryTermListItem) => (
          <div>
            <div>{formatUpdatedAt(String(value))}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('updatedBy', { name: record.updatedBy })}
            </div>
          </div>
        )
      },
      {
        key: 'operations',
        title: t('colOperations'),
        dataIndex: 'id',
        headerClassName: 'pr-0 whitespace-nowrap text-right',
        cellClassName: 'py-3 pr-0 align-top',
        align: 'right' as const,
        render: (value: unknown, record: GlossaryTermListItem) =>
          canManage ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => openEdit(record)}>
                {t('edit')}
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => toggleStatus(record)}>
                {record.status === 'enabled' ? t('disable') : t('enable')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => requestDelete([Number(value)])}
              >
                {t('delete')}
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('empty')}</span>
          )
      }
    ],
    [canManage, isPending, t]
  );

  const negativeColumns = useMemo<Array<TableColumn<NegativePromptListItem>>>(
    () => [
      {
        key: 'phrase',
        title: t('negativeColPhrase'),
        dataIndex: 'phrase',
        headerClassName: 'pr-4',
        cellClassName: 'py-3 pr-4 font-medium text-foreground align-top'
      },
      {
        key: 'alternative',
        title: t('negativeColAlternative'),
        dataIndex: 'alternative',
        headerClassName: 'pr-4',
        cellClassName: 'py-3 pr-4 text-muted-foreground align-top',
        render: (value: unknown) => (value ? String(value) : t('empty'))
      },
      {
        key: 'status',
        title: t('colStatus'),
        dataIndex: 'status',
        headerClassName: 'pr-4 whitespace-nowrap',
        cellClassName: 'py-3 pr-4 align-top',
        render: (value: unknown) => (
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
              value === 'enabled' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            )}
          >
            {value === 'enabled' ? t('statusEnabled') : t('statusDisabled')}
          </span>
        )
      },
      {
        key: 'note',
        title: t('colNote'),
        dataIndex: 'note',
        headerClassName: 'pr-4',
        cellClassName: 'py-3 pr-4 align-top',
        render: (value: unknown) => renderNote(value as string | null | undefined)
      },
      {
        key: 'updatedAt',
        title: t('colUpdatedAt'),
        dataIndex: 'updatedAt',
        headerClassName: 'pr-4 whitespace-nowrap',
        cellClassName: 'py-3 pr-4 whitespace-nowrap text-muted-foreground align-top',
        render: (value: unknown, record: NegativePromptListItem) => (
          <div>
            <div>{formatUpdatedAt(String(value))}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('updatedBy', { name: record.updatedBy })}
            </div>
          </div>
        )
      },
      {
        key: 'operations',
        title: t('colOperations'),
        dataIndex: 'id',
        headerClassName: 'pr-0 whitespace-nowrap text-right',
        cellClassName: 'py-3 pr-0 align-top',
        align: 'right' as const,
        render: (value: unknown, record: NegativePromptListItem) =>
          canManage ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => openEdit(record)}>
                {t('edit')}
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => toggleStatus(record)}>
                {record.status === 'enabled' ? t('disable') : t('enable')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => requestDelete([Number(value)])}
              >
                {t('delete')}
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('empty')}</span>
          )
      }
    ],
    [canManage, isPending, t]
  );

  const openCreate = () => {
    setEditingId(null);
    setFormError('');
    if (tab === 'terms') {
      setTermForm({ source: '', target: '', type: 'recommended', status: 'enabled', note: '' });
    } else {
      setNegativeForm({ phrase: '', alternative: '', status: 'enabled', note: '' });
    }
    setEditOpen(true);
  };

  const openEdit = (item: GlossaryTermListItem | NegativePromptListItem) => {
    setFormError('');
    if (tab === 'terms') {
      const it = item as GlossaryTermListItem;
      setEditingId(it.id);
      setTermForm({
        source: it.source,
        target: it.target,
        type: it.type,
        status: it.status,
        note: it.note ?? ''
      });
    } else {
      const it = item as NegativePromptListItem;
      setEditingId(it.id);
      setNegativeForm({
        phrase: it.phrase,
        alternative: it.alternative ?? '',
        status: it.status,
        note: it.note ?? ''
      });
    }
    setEditOpen(true);
  };

  const requestDelete = (ids: number[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const applyFilterChange = <T,>(setter: (v: T) => void, next: T) => {
    setter(next);
    if (tab === 'terms') setTerms((prev) => ({ ...prev, page: 1 }));
    else setNegatives((prev) => ({ ...prev, page: 1 }));
  };

  const changePage = (nextPage: number) => {
    const safe = Math.min(Math.max(1, nextPage), pageCount);
    if (tab === 'terms') setTerms((prev) => ({ ...prev, page: safe }));
    else setNegatives((prev) => ({ ...prev, page: safe }));
  };

  const submitEdit = () => {
    setFormError('');
    startTransition(async () => {
      if (!locale) return;

      if (tab === 'terms') {
        if (!termForm.source.trim() || !termForm.target.trim()) {
          setFormError(t('formRequiredError'));
          return;
        }

        const res = editingId
          ? await updateGlossaryTermAction({
              projectId,
              termId: editingId,
              locale,
              source: termForm.source,
              target: termForm.target,
              type: termForm.type,
              status: termForm.status,
              note: termForm.note
            })
          : await createGlossaryTermAction({
              projectId,
              locale,
              source: termForm.source,
              target: termForm.target,
              type: termForm.type,
              status: termForm.status,
              note: termForm.note
            });

        if (!res.ok) {
          setFormError(res.error);
          return;
        }

        push({ variant: 'default', message: res.success });
        setEditOpen(false);
        const listRes = await listGlossaryTermsQuery({
          projectId,
          locale,
          query,
          type: termType,
          status: termStatus,
          page: terms.page,
          pageSize: terms.pageSize
        });
        if (listRes.ok) setTerms(listRes.data);
        return;
      }

      if (!negativeForm.phrase.trim()) {
        setFormError(t('negativeRequiredError'));
        return;
      }

      const res = editingId
        ? await updateNegativePromptAction({
            projectId,
            promptId: editingId,
            locale,
            phrase: negativeForm.phrase,
            alternative: negativeForm.alternative,
            status: negativeForm.status,
            note: negativeForm.note
          })
        : await createNegativePromptAction({
            projectId,
            locale,
            phrase: negativeForm.phrase,
            alternative: negativeForm.alternative,
            status: negativeForm.status,
            note: negativeForm.note
          });

      if (!res.ok) {
        setFormError(res.error);
        return;
      }

      push({ variant: 'default', message: res.success });
      setEditOpen(false);
      const listRes = await listNegativePromptsQuery({
        projectId,
        locale,
        query,
        status: negativeStatus,
        page: negatives.page,
        pageSize: negatives.pageSize
      });
      if (listRes.ok) setNegatives(listRes.data);
    });
  };

  const toggleStatus = (item: GlossaryTermListItem | NegativePromptListItem) => {
    if (!canManage) return;
    startTransition(async () => {
      if (tab === 'terms') {
        const it = item as GlossaryTermListItem;
        const nextStatus = it.status === 'enabled' ? 'disabled' : 'enabled';
        const res = await toggleGlossaryTermStatusAction({
          projectId,
          termId: it.id,
          nextStatus
        });
        if (!res.ok) {
          push({ variant: 'destructive', message: res.error });
          return;
        }
        push({ variant: 'default', message: res.success });
        const listRes = await listGlossaryTermsQuery({
          projectId,
          locale,
          query,
          type: termType,
          status: termStatus,
          page: terms.page,
          pageSize: terms.pageSize
        });
        if (listRes.ok) setTerms(listRes.data);
        return;
      }

      const it = item as NegativePromptListItem;
      const nextStatus = it.status === 'enabled' ? 'disabled' : 'enabled';
      const res = await toggleNegativePromptStatusAction({
        projectId,
        promptId: it.id,
        nextStatus
      });
      if (!res.ok) {
        push({ variant: 'destructive', message: res.error });
        return;
      }
      push({ variant: 'default', message: res.success });
      const listRes = await listNegativePromptsQuery({
        projectId,
        locale,
        query,
        status: negativeStatus,
        page: negatives.page,
        pageSize: negatives.pageSize
      });
      if (listRes.ok) setNegatives(listRes.data);
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const ids = deleteIds.slice();
      setDeleteOpen(false);
      setDeleteIds([]);
      if (ids.length === 0) return;

      const res =
        tab === 'terms'
          ? await deleteGlossaryTermsAction({ projectId, termIds: ids })
          : await deleteNegativePromptsAction({ projectId, promptIds: ids });

      if (!res.ok) {
        push({ variant: 'destructive', message: res.error });
        return;
      }
      push({ variant: 'default', message: res.success });
      if (!locale) return;
      if (tab === 'terms') {
        const listRes = await listGlossaryTermsQuery({
          projectId,
          locale,
          query,
          type: termType,
          status: termStatus,
          page: terms.page,
          pageSize: terms.pageSize
        });
        if (listRes.ok) setTerms(listRes.data);
      } else {
        const listRes = await listNegativePromptsQuery({
          projectId,
          locale,
          query,
          status: negativeStatus,
          page: negatives.page,
          pageSize: negatives.pageSize
        });
        if (listRes.ok) setNegatives(listRes.data);
      }
    });
  };

  if (targetLocales.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('emptyTargetLocalesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">{t('emptyTargetLocalesDesc')}</div>
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/settings/locales`}>{t('goToLocales')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'terms' | 'negative')}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <TabsList>
                <TabsTrigger value="terms">{t('tabTerms')}</TabsTrigger>
                <TabsTrigger value="negative">{t('tabNegative')}</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                {canManage ? (
                  <Button onClick={openCreate} disabled={!locale || isPending}>
                    {tab === 'terms' ? t('create') : t('negativeCreate')}
                  </Button>
                ) : null}
              </div>
            </div>
          </Tabs>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="glossary-locale">{t('targetLocale')}</Label>
                <TargetLocaleSelect
                  id="glossary-locale"
                  targetLocales={targetLocales}
                  value={locale}
                  onValueChange={(next) => {
                    setLocale(next);
                    setTerms((prev) => ({ ...prev, page: 1 }));
                    setNegatives((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="mt-1 w-full"
                />
              </div>
              {tab === 'terms' ? (
                <div>
                  <Label htmlFor="glossary-type">{t('filterType')}</Label>
                  <Select
                    id="glossary-type"
                    value={termType}
                    onValueChange={(value) => applyFilterChange(setTermType, value as FilterType)}
                    placeholder={t('all')}
                    className="mt-1 h-10 w-full"
                    options={[
                      { value: 'all', label: t('all') },
                      { value: 'recommended', label: t('typeRecommended') },
                      { value: 'forced', label: t('typeForced') }
                    ]}
                  />
                </div>
              ) : null}

              <div>
                <Label htmlFor="glossary-status">{t('filterStatus')}</Label>
                <Select
                  id="glossary-status"
                  value={tab === 'terms' ? termStatus : negativeStatus}
                  onValueChange={(value) =>
                    tab === 'terms'
                      ? applyFilterChange(setTermStatus, value as FilterStatus)
                      : applyFilterChange(setNegativeStatus, value as FilterStatus)
                  }
                  placeholder={t('all')}
                  className="mt-1 h-10 w-full"
                  options={[
                    { value: 'all', label: t('all') },
                    { value: 'enabled', label: t('statusEnabled') },
                    { value: 'disabled', label: t('statusDisabled') }
                  ]}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <Label htmlFor="glossary-search">{t('search')}</Label>
                <div className="mt-1">
                  <Input
                    id="glossary-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {tab === 'terms' ? t('termTotal', { count: terms.total }) : t('negativeTotal', { count: negatives.total })}
            </div>
          </div>

          {canManage ? null : (
            <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
              {t('readonlyHint')}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {showEmpty ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-sm font-medium text-foreground">{t('emptyTitle')}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t('emptyDesc')}</div>
              {canManage ? (
                <div className="mt-4">
                  <Button onClick={openCreate}>
                    {tab === 'terms' ? t('create') : t('negativeCreate')}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : viewItems.length ? (
            <div className="space-y-4">
              {tab === 'terms' ? (
                <Table
                  columns={termColumns}
                  data={terms.items}
                  rowKey="id"
                  loading={loading}
                  emptyText={t('emptyTitle')}
                />
              ) : (
                <Table
                  columns={negativeColumns}
                  data={negatives.items}
                  rowKey="id"
                  loading={loading}
                  emptyText={t('emptyTitle')}
                />
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {t('pagination', {
                    page: tab === 'terms' ? terms.page : negatives.page,
                    pageCount
                  })}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(tab === 'terms' ? terms.page : negatives.page) <= 1 || isPending}
                    onClick={() => changePage((tab === 'terms' ? terms.page : negatives.page) - 1)}
                  >
                    {t('prev')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(tab === 'terms' ? terms.page : negatives.page) >= pageCount || isPending}
                    onClick={() => changePage((tab === 'terms' ? terms.page : negatives.page) + 1)}
                  >
                    {t('next')}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setFormError('');
        }}
        contentClassName="max-w-2xl"
        title={
          tab === 'terms'
            ? editingId
              ? t('editTitle')
              : t('createTitle')
            : editingId
              ? t('negativeEditTitle')
              : t('negativeCreateTitle')
        }
        description={t('dialogDesc', { locale })}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitEdit} disabled={isPending}>
              {t('save')}
            </Button>
          </>
        }
      >
          {formError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          {tab === 'terms' ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="glossary-source">{t('formSource')}</Label>
                  <div className="mt-1">
                    <Input
                      id="glossary-source"
                      value={termForm.source}
                      onChange={(e) =>
                        setTermForm((prev) => ({ ...prev, source: e.target.value }))
                      }
                      placeholder={t('formSourcePlaceholder')}
                      maxLength={200}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="glossary-target">{t('formTarget')}</Label>
                  <div className="mt-1">
                    <Input
                      id="glossary-target"
                      value={termForm.target}
                      onChange={(e) =>
                        setTermForm((prev) => ({ ...prev, target: e.target.value }))
                      }
                      placeholder={t('formTargetPlaceholder')}
                      maxLength={200}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t('formType')}</Label>
                  <RadioGroup
                    value={termForm.type}
                    onValueChange={(value) =>
                      setTermForm((prev) => ({ ...prev, type: value as GlossaryType }))
                    }
                    className="mt-2 gap-2"
                    options={[
                      {
                        value: 'recommended',
                        label: (
                          <>
                            <span className="text-foreground">{t('typeRecommended')}</span>
                            <span className="text-muted-foreground">{t('typeRecommendedHint')}</span>
                          </>
                        )
                      },
                      {
                        value: 'forced',
                        label: (
                          <>
                            <span className="text-foreground">{t('typeForced')}</span>
                            <span className="text-muted-foreground">{t('typeForcedHint')}</span>
                          </>
                        )
                      }
                    ]}
                  />
                </div>
                <div>
                  <Label>{t('formStatus')}</Label>
                  <RadioGroup
                    value={termForm.status}
                    onValueChange={(value) =>
                      setTermForm((prev) => ({ ...prev, status: value as GlossaryStatus }))
                    }
                    className="mt-2 gap-2"
                    options={[
                      { value: 'enabled', label: <span className="text-foreground">{t('statusEnabled')}</span> },
                      { value: 'disabled', label: <span className="text-foreground">{t('statusDisabled')}</span> }
                    ]}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="glossary-note">{t('formNote')}</Label>
                <div className="mt-1">
                  <textarea
                    id="glossary-note"
                    value={termForm.note}
                    onChange={(e) =>
                      setTermForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder={t('formNotePlaceholder')}
                    maxLength={500}
                    className="min-h-[84px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{t('formNoteHelp')}</div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="negative-phrase">{t('negativePhrase')}</Label>
                  <div className="mt-1">
                    <Input
                      id="negative-phrase"
                      value={negativeForm.phrase}
                      onChange={(e) =>
                        setNegativeForm((prev) => ({ ...prev, phrase: e.target.value }))
                      }
                      placeholder={t('negativePhrasePlaceholder')}
                      maxLength={200}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="negative-alt">{t('negativeAlternative')}</Label>
                  <div className="mt-1">
                    <Input
                      id="negative-alt"
                      value={negativeForm.alternative}
                      onChange={(e) =>
                        setNegativeForm((prev) => ({
                          ...prev,
                          alternative: e.target.value
                        }))
                      }
                      placeholder={t('negativeAlternativePlaceholder')}
                      maxLength={200}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>{t('formStatus')}</Label>
                <RadioGroup
                  value={negativeForm.status}
                  onValueChange={(value) =>
                    setNegativeForm((prev) => ({ ...prev, status: value as GlossaryStatus }))
                  }
                  className="mt-2 gap-2"
                  options={[
                    { value: 'enabled', label: <span className="text-foreground">{t('statusEnabled')}</span> },
                    { value: 'disabled', label: <span className="text-foreground">{t('statusDisabled')}</span> }
                  ]}
                />
              </div>

              <div>
                <Label htmlFor="negative-note">{t('formNote')}</Label>
                <div className="mt-1">
                  <textarea
                    id="negative-note"
                    value={negativeForm.note}
                    onChange={(e) =>
                      setNegativeForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder={t('formNotePlaceholder')}
                    maxLength={500}
                    className="min-h-[84px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </div>
              </div>
            </>
          )}

      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteTitle')}
        description={t('deleteDesc', { count: deleteIds.length })}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {t('confirmDelete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
