'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

type TargetLocale = {
  code: string;
  label: string;
};

type EntryStatus = 'untranslated' | 'pending_review' | 'updated' | 'approved';

type EntryTranslation = {
  target: string;
  status: EntryStatus;
  updatedAt: string;
  updatedBy: string;
};

type Placement = {
  pageId: string;
  moduleId?: string;
};

type EntryRow = {
  key: string;
  source: string;
  placements: Placement[];
  translations: Record<string, EntryTranslation | undefined>;
};

type ModuleNode = {
  id: string;
  name: string;
  keyCount?: number;
};

type PageNode = {
  id: string;
  route: string;
  title?: string;
  keyCount?: number;
  modules: ModuleNode[];
};

type Scope =
  | { type: 'page'; pageId: string }
  | { type: 'module'; pageId: string; moduleId: string };

type MockMode = 'success' | 'loading' | 'error' | 'emptyLocales' | 'emptyPages' | 'emptyData';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

function statusMeta(status: EntryStatus) {
  switch (status) {
    case 'untranslated':
      return { tone: 'muted', i18nKey: 'status.untranslated' } as const;
    case 'pending_review':
      return { tone: 'warning', i18nKey: 'status.pendingReview' } as const;
    case 'updated':
      return { tone: 'info', i18nKey: 'status.updated' } as const;
    case 'approved':
      return { tone: 'success', i18nKey: 'status.approved' } as const;
  }
}

function StatusPill({ status, label }: { status: EntryStatus; label: string }) {
  const meta = statusMeta(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        meta.tone === 'muted' && 'border-border bg-muted text-foreground',
        meta.tone === 'warning' && 'border-warning/30 bg-warning/10 text-foreground',
        meta.tone === 'info' && 'border-info/30 bg-info/10 text-foreground',
        meta.tone === 'success' && 'border-success/30 bg-success/10 text-foreground'
      )}
    >
      {label}
    </span>
  );
}

function makeMockData() {
  const pages: PageNode[] = [
    {
      id: 'p-settings',
      route: '/settings',
      title: '项目设置',
      keyCount: 18,
      modules: [
        { id: 'm-basic', name: '基本信息', keyCount: 6 },
        { id: 'm-locales', name: '语言管理', keyCount: 7 },
        { id: 'm-members', name: '成员管理', keyCount: 5 }
      ]
    },
    {
      id: 'p-dashboard',
      route: '/dashboard',
      title: '项目列表',
      keyCount: 12,
      modules: [
        { id: 'm-table', name: '表格区', keyCount: 8 },
        { id: 'm-empty', name: '空态区', keyCount: 4 }
      ]
    },
    {
      id: 'p-login',
      route: '/sign-in',
      title: '登录页',
      keyCount: 9,
      modules: [
        { id: 'm-form', name: '表单区', keyCount: 7 },
        { id: 'm-footer', name: '底部提示', keyCount: 2 }
      ]
    }
  ];

  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const userA = 'Alice';
  const userB = 'Bob';
  const userC = 'Charlie';

  const entries: EntryRow[] = [
    {
      key: 'project.settings.title',
      source: '项目设置',
      placements: [{ pageId: 'p-settings', moduleId: 'm-basic' }],
      translations: {
        en: { target: 'Project settings', status: 'approved', updatedAt: ago(2400), updatedBy: userA },
        'ja-JP': { target: 'プロジェクト設定', status: 'approved', updatedAt: ago(2300), updatedBy: userB }
      }
    },
    {
      key: 'project.settings.subtitle',
      source: '集中管理当前项目的语言、成员、质量策略与个性化。',
      placements: [{ pageId: 'p-settings', moduleId: 'm-basic' }],
      translations: {
        en: { target: 'Manage locales, members, quality policy, and personalization.', status: 'updated', updatedAt: ago(90), updatedBy: userC },
        'ja-JP': { target: '', status: 'untranslated', updatedAt: ago(8000), updatedBy: userB }
      }
    },
    {
      key: 'project.settings.save',
      source: '保存',
      placements: [{ pageId: 'p-settings', moduleId: 'm-basic' }],
      translations: {
        en: { target: 'Save', status: 'approved', updatedAt: ago(1500), updatedBy: userA },
        'ja-JP': { target: '保存', status: 'pending_review', updatedAt: ago(40), updatedBy: userC }
      }
    },
    {
      key: 'project.locales.addTitle',
      source: '添加目标语言',
      placements: [{ pageId: 'p-settings', moduleId: 'm-locales' }],
      translations: {
        en: { target: 'Add target locales', status: 'pending_review', updatedAt: ago(22), updatedBy: userB },
        'ja-JP': { target: '対象ロケールを追加', status: 'approved', updatedAt: ago(2200), updatedBy: userA }
      }
    },
    {
      key: 'dashboard.projects.emptyTitle',
      source: '暂无可访问项目',
      placements: [{ pageId: 'p-dashboard', moduleId: 'm-empty' }],
      translations: {
        en: { target: 'No accessible projects', status: 'approved', updatedAt: ago(3300), updatedBy: userB },
        'ja-JP': { target: 'アクセス可能なプロジェクトはありません', status: 'approved', updatedAt: ago(3100), updatedBy: userA }
      }
    },
    {
      key: 'dashboard.projects.create',
      source: '新建项目',
      placements: [
        { pageId: 'p-dashboard', moduleId: 'm-table' },
        { pageId: 'p-settings', moduleId: 'm-basic' }
      ],
      translations: {
        en: { target: 'New project', status: 'approved', updatedAt: ago(4300), updatedBy: userA },
        'ja-JP': { target: '新規プロジェクト', status: 'approved', updatedAt: ago(4200), updatedBy: userB }
      }
    },
    {
      key: 'auth.signIn.title',
      source: '登录',
      placements: [{ pageId: 'p-login', moduleId: 'm-form' }],
      translations: {
        en: { target: 'Sign in', status: 'approved', updatedAt: ago(6000), updatedBy: userB },
        'ja-JP': { target: 'ログイン', status: 'approved', updatedAt: ago(5900), updatedBy: userA }
      }
    },
    {
      key: 'auth.signIn.passwordPlaceholder',
      source: '请输入密码',
      placements: [{ pageId: 'p-login', moduleId: 'm-form' }],
      translations: {
        en: { target: 'Enter password', status: 'approved', updatedAt: ago(5800), updatedBy: userA },
        'ja-JP': { target: 'パスワードを入力', status: 'approved', updatedAt: ago(5700), updatedBy: userB }
      }
    },
    {
      key: 'auth.signIn.forgot',
      source: '忘记密码？',
      placements: [{ pageId: 'p-login', moduleId: 'm-footer' }],
      translations: {
        en: { target: '', status: 'untranslated', updatedAt: ago(9000), updatedBy: userC },
        'ja-JP': { target: '', status: 'untranslated', updatedAt: ago(9000), updatedBy: userC }
      }
    }
  ];

  const targetLocales: TargetLocale[] = [
    { code: 'en', label: 'English' },
    { code: 'ja-JP', label: '日本語' }
  ];

  return { pages, entries, targetLocales };
}

function getScopeLabel(pages: PageNode[], scope: Scope) {
  const page = pages.find((p) => p.id === scope.pageId);
  if (!page) return { primary: '—', secondary: '' };
  if (scope.type === 'page') {
    return {
      primary: page.route,
      secondary: page.title ? `（${page.title}）` : ''
    };
  }
  const module = page.modules.find((m) => m.id === scope.moduleId);
  return {
    primary: `${page.route} / ${module?.name || '—'}`,
    secondary: page.title ? `（${page.title}）` : ''
  };
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function isEntryInScope(entry: EntryRow, scope: Scope) {
  if (scope.type === 'page') {
    return entry.placements.some((p) => p.pageId === scope.pageId);
  }
  return entry.placements.some((p) => p.pageId === scope.pageId && p.moduleId === scope.moduleId);
}

function uniquePlacements(entries: EntryRow[], pages: PageNode[]) {
  const pageById = new Map(pages.map((p) => [p.id, p] as const));
  const moduleById = new Map(
    pages.flatMap((p) => p.modules.map((m) => [`${p.id}:${m.id}`, m] as const))
  );

  return (placements: Placement[]) => {
    const labels = placements.map((pl) => {
      const page = pageById.get(pl.pageId);
      if (!page) return '—';
      if (!pl.moduleId) return page.route;
      const module = moduleById.get(`${pl.pageId}:${pl.moduleId}`);
      return `${page.route} / ${module?.name || '—'}`;
    });
    return Array.from(new Set(labels));
  };
}

export function ProjectWorkbenchClient({ projectId }: { projectId: number }) {
  const t = useTranslations('projectWorkbench');
  const toast = useToast();
  const searchParams = useSearchParams();
  const highlightKey = searchParams.get('key') || '';

  const requestedLocale = searchParams.get('locale') || searchParams.get('to') || '';
  const requestedPageId = searchParams.get('page') || '';
  const requestedModuleId = searchParams.get('module') || '';

  const mode = (searchParams.get('state') as MockMode | null) || 'success';
  const ai = (searchParams.get('ai') || 'notInstalled') as 'ready' | 'notInstalled' | 'expired';

  const { pages: basePages, entries: baseEntries, targetLocales: baseTargetLocales } = useMemo(
    () => makeMockData(),
    []
  );

  const targetLocales = mode === 'emptyLocales' ? [] : baseTargetLocales;
  const pages = mode === 'emptyPages' ? [] : basePages;
  const initialEntries = mode === 'emptyData' ? [] : baseEntries;

  const [entries, setEntries] = useState<EntryRow[]>(initialEntries);
  const [treeQuery, setTreeQuery] = useState('');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const p of pages) next[p.id] = true;
    return next;
  });
  const [scope, setScope] = useState<Scope>(() =>
    pages.length > 0 ? { type: 'page', pageId: pages[0]!.id } : { type: 'page', pageId: '' }
  );

  const [locale, setLocale] = useState<string>(() => targetLocales[0]?.code || '');
  const [query, setQuery] = useState('');

  const [statusFilter, setStatusFilter] = useState<Record<EntryStatus, boolean>>({
    untranslated: false,
    pending_review: true,
    updated: true,
    approved: false
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});

  const [conflict, setConflict] = useState<null | {
    key: string;
    keepDraft: string;
  }>(null);

  const [detailsKey, setDetailsKey] = useState<string>('');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    if (!highlightKey) return;
    const el = rowRefs.current[highlightKey];
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
  }, [highlightKey, scope, locale, query, statusFilter]);

  useEffect(() => {
    if (!requestedLocale) return;
    if (targetLocales.length === 0) return;
    if (!targetLocales.some((l) => l.code === requestedLocale)) return;
    setLocale(requestedLocale);
  }, [requestedLocale, targetLocales]);

  useEffect(() => {
    if (!requestedPageId) return;
    if (pages.length === 0) return;
    const page = pages.find((p) => p.id === requestedPageId);
    if (!page) return;

    if (requestedModuleId) {
      const module = page.modules.find((m) => m.id === requestedModuleId);
      if (module) {
        setScope({ type: 'module', pageId: page.id, moduleId: module.id });
        setExpanded(page.id, true);
        return;
      }
    }

    setScope({ type: 'page', pageId: page.id });
    setExpanded(page.id, true);
  }, [pages, requestedModuleId, requestedPageId]);

  useEffect(() => {
    setDrafts({});
    setSelectedKeys({});
  }, [locale, scope.pageId, scope.type, scope.type === 'module' ? scope.moduleId : '']);

  const filteredTree = useMemo(() => {
    const q = normalize(treeQuery);
    if (!q) return pages;
    return pages
      .map((p) => {
        const pageHit = normalize(p.route).includes(q) || normalize(p.title || '').includes(q);
        const modules = p.modules.filter((m) => normalize(m.name).includes(q));
        if (pageHit) return p;
        if (modules.length === 0) return null;
        return { ...p, modules };
      })
      .filter(Boolean) as PageNode[];
  }, [pages, treeQuery]);

  const placementToLabels = useMemo(() => uniquePlacements(entries, pages), [entries, pages]);

  const visibleEntries = useMemo(() => {
    if (!locale) return [];
    const q = normalize(query);
    return entries
      .filter((e) => isEntryInScope(e, scope))
      .filter((e) => {
        const tr = e.translations[locale];
        const status = tr?.status || 'untranslated';
        return Boolean(statusFilter[status]);
      })
      .filter((e) => {
        if (!q) return true;
        const tr = e.translations[locale];
        return (
          normalize(e.key).includes(q) ||
          normalize(e.source).includes(q) ||
          normalize(tr?.target || '').includes(q)
        );
      });
  }, [entries, locale, query, scope, statusFilter]);

  const scopeLabel = useMemo(() => getScopeLabel(pages, scope), [pages, scope]);

  const canAITranslate = mode !== 'loading' && mode !== 'error' && Boolean(locale);
  const canMTFill = mode !== 'loading' && mode !== 'error' && Boolean(locale);

  const aiBadge =
    ai === 'notInstalled' ? t('aiBadge.needEngine') : ai === 'expired' ? t('aiBadge.expired') : '';

  const setExpanded = (pageId: string, next: boolean) =>
    setExpandedPages((prev) => ({ ...prev, [pageId]: next }));

  const getTranslation = (e: EntryRow): EntryTranslation => {
    const tr = e.translations[locale];
    if (tr) return tr;
    return { target: '', status: 'untranslated', updatedAt: '', updatedBy: '' };
  };

  const getDraft = (e: EntryRow) => {
    if (drafts[e.key] !== undefined) return drafts[e.key]!;
    return getTranslation(e).target;
  };

  const isDirty = (e: EntryRow) => getDraft(e) !== getTranslation(e).target;

  const applySave = (key: string, nextTarget: string) => {
    const now = new Date().toISOString();
    setEntries((prev) =>
      prev.map((e) => {
        if (e.key !== key) return e;
        const prevTr = e.translations[locale];
        const nextTr: EntryTranslation = {
          target: nextTarget,
          status: 'pending_review',
          updatedAt: now,
          updatedBy: 'You'
        };
        return {
          ...e,
          translations: {
            ...e.translations,
            [locale]: { ...prevTr, ...nextTr }
          }
        };
      })
    );
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const trySave = (key: string) => {
    const entry = entries.find((e) => e.key === key);
    if (!entry) return;
    const draft = getDraft(entry);
    if (!draft.trim()) {
      toast.push({ title: t('toast.invalidTitle'), message: t('toast.invalidEmpty'), variant: 'destructive' });
      return;
    }

    const conflictChance = (key.charCodeAt(0) + key.length) % 11 === 0;
    const current = getTranslation(entry);
    if (current.status === 'updated' && conflictChance) {
      setConflict({ key, keepDraft: draft });
      return;
    }

    applySave(key, draft);
    toast.push({ title: t('toast.savedTitle'), message: t('toast.savedMessage'), variant: 'default' });
  };

  const resetDraft = (key: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const batchApprove = () => {
    const keys = visibleEntries.filter((e) => selectedKeys[e.key]).map((e) => e.key);
    if (keys.length === 0) return;
    const now = new Date().toISOString();
    setEntries((prev) =>
      prev.map((e) => {
        if (!keys.includes(e.key)) return e;
        const tr = getTranslation(e);
        return {
          ...e,
          translations: {
            ...e.translations,
            [locale]: { ...tr, status: 'approved', updatedAt: now, updatedBy: 'You' }
          }
        };
      })
    );
    setSelectedKeys({});
    toast.push({ title: t('toast.approvedTitle'), message: t('toast.approvedMessage', { count: keys.length }), variant: 'default' });
  };

  const mtFill = () => {
    const now = new Date().toISOString();
    let affected = 0;

    setEntries((prev) =>
      prev.map((e) => {
        if (!isEntryInScope(e, scope)) return e;
        const tr = e.translations[locale];
        const status = tr?.status || 'untranslated';
        if (!(status === 'untranslated' || status === 'pending_review')) return e;
        affected += 1;
        return {
          ...e,
          translations: {
            ...e.translations,
            [locale]: {
              target: tr?.target?.trim() ? tr.target : `${e.source} (MT)`,
              status: 'pending_review',
              updatedAt: now,
              updatedBy: 'MT'
            }
          }
        };
      })
    );

    toast.push({
      title: t('toast.mtTitle'),
      message: t('toast.mtMessage', { count: affected }),
      variant: 'default'
    });
  };

  const aiTranslate = () => {
    if (ai === 'notInstalled') {
      toast.push({ title: t('toast.aiBlockedTitle'), message: t('toast.aiNeedEngine'), variant: 'destructive' });
      return;
    }
    if (ai === 'expired') {
      toast.push({ title: t('toast.aiBlockedTitle'), message: t('toast.aiExpired'), variant: 'destructive' });
      return;
    }
    const now = new Date().toISOString();
    let affected = 0;
    setEntries((prev) =>
      prev.map((e) => {
        if (!isEntryInScope(e, scope)) return e;
        affected += 1;
        return {
          ...e,
          translations: {
            ...e.translations,
            [locale]: {
              target: `${e.source} (AI)`,
              status: 'pending_review',
              updatedAt: now,
              updatedBy: 'AI'
            }
          }
        };
      })
    );
    toast.push({ title: t('toast.aiTitle'), message: t('toast.aiMessage', { count: affected }), variant: 'default' });
  };

  if (mode === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('loading.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t('loading.desc')}</CardContent>
      </Card>
    );
  }

  if (mode === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            {t('error.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-3">
          <div>{t('error.desc')}</div>
          <Button asChild variant="outline" className="w-fit">
            <Link href={`/projects/${projectId}/workbench`}>{t('error.retry')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (targetLocales.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('emptyLocales.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-3">
          <div>{t('emptyLocales.desc')}</div>
          <Button asChild className="w-fit">
            <Link href={`/projects/${projectId}/settings/locales`}>{t('emptyLocales.go')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('emptyPages.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground flex flex-col gap-3">
          <div>{t('emptyPages.desc')}</div>
          <Button asChild className="w-fit">
            <Link href={`/projects/${projectId}/context`}>{t('emptyPages.go')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('emptyData.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t('emptyData.desc')}</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">{t('tree.title')}</CardTitle>
            <Button asChild variant="outline" className="h-8 px-2">
              <Link href={`/projects/${projectId}/context`}>
                <ExternalLink className="size-4" />
                <span className="ml-1 text-sm">{t('tree.goContext')}</span>
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={treeQuery}
              onChange={(e) => setTreeQuery(e.target.value)}
              placeholder={t('tree.searchPlaceholder')}
              className="pl-9"
            />
          </div>

          <div className="mt-3 max-h-[calc(100dvh-260px)] overflow-y-auto pr-2 scrollbar-hover">
            <div className="space-y-1">
              {filteredTree.length === 0 ? (
                <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  {t('tree.emptySearch')}
                </div>
              ) : (
                filteredTree.map((p) => {
                  const open = expandedPages[p.id] ?? true;
                  const isPageActive = scope.type === 'page' && scope.pageId === p.id;

                  return (
                    <div key={p.id} className="rounded-lg border border-border bg-background">
                      <button
                        type="button"
                        onClick={() => {
                          setExpanded(p.id, !open);
                          setScope({ type: 'page', pageId: p.id });
                        }}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                          isPageActive ? 'bg-accent' : 'hover:bg-accent/60'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-muted-foreground">
                            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 text-muted-foreground" />
                              <div className="min-w-0 font-medium text-foreground truncate">{p.route}</div>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{p.title || t('tree.untitledPage')}</span>
                              {typeof p.keyCount === 'number' ? (
                                <span className="shrink-0">· {t('tree.keyCount', { count: p.keyCount })}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>

                      {open ? (
                        <div className="px-2 pb-2">
                          {p.modules.length === 0 ? (
                            <div className="px-2 pb-2 text-xs text-muted-foreground">{t('tree.noModules')}</div>
                          ) : (
                            <div className="space-y-1">
                              {p.modules.map((m) => {
                                const active =
                                  scope.type === 'module' && scope.pageId === p.id && scope.moduleId === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setScope({ type: 'module', pageId: p.id, moduleId: m.id })}
                                    className={cn(
                                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                                      active ? 'bg-accent' : 'hover:bg-accent/60'
                                    )}
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <Layers className="size-4 text-muted-foreground" />
                                      <span className="truncate text-foreground">{m.name}</span>
                                    </span>
                                    {typeof m.keyCount === 'number' ? (
                                      <span className="shrink-0 text-xs text-muted-foreground">
                                        {t('tree.keyCount', { count: m.keyCount })}
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-220px)] lg:min-h-0">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9">
                      <span className="text-sm text-muted-foreground">{t('filters.targetLocale')}：</span>
                      <span className="ml-1 text-sm font-medium text-foreground">
                        {locale || t('filters.targetLocaleEmpty')}
                      </span>
                      <ChevronDown className="ml-2 size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[220px]">
                    <DropdownMenuLabel>{t('filters.chooseLocale')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v)}>
                      {targetLocales.map((l) => (
                        <DropdownMenuRadioItem key={l.code} value={l.code}>
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="text-foreground">{l.label}</span>
                            <span className="text-xs text-muted-foreground">{l.code}</span>
                          </span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="hidden h-5 w-px bg-border lg:block" />

                <div className="text-sm">
                  <span className="text-muted-foreground">{t('filters.scope')}：</span>
                  <span className="font-medium text-foreground">{scopeLabel.primary}</span>
                  {scopeLabel.secondary ? (
                    <span className="ml-1 text-muted-foreground">{scopeLabel.secondary}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[260px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('filters.searchPlaceholder')}
                    className="pl-9"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9">
                      {t('filters.status')}
                      <ChevronDown className="ml-2 size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[220px]">
                    <DropdownMenuLabel>{t('filters.status')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(
                      [
                        ['untranslated', t('status.untranslated')],
                        ['pending_review', t('status.pendingReview')],
                        ['updated', t('status.updated')],
                        ['approved', t('status.approved')]
                      ] as const
                    ).map(([k, label]) => (
                      <DropdownMenuCheckboxItem
                        key={k}
                        checked={statusFilter[k]}
                        onCheckedChange={(checked) =>
                          setStatusFilter((prev) => ({ ...prev, [k]: Boolean(checked) }))
                        }
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="hidden h-5 w-px bg-border lg:block" />

                <Button
                  variant="outline"
                  className="h-9"
                  onClick={aiTranslate}
                  disabled={!canAITranslate}
                >
                  <Sparkles className="mr-2 size-4" />
                  {t('actions.aiTranslate')}
                  {aiBadge ? (
                    <span className="ml-2 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {aiBadge}
                    </span>
                  ) : null}
                </Button>

                <Button
                  variant="outline"
                  className="h-9"
                  onClick={mtFill}
                  disabled={!canMTFill}
                >
                  <Wand2 className="mr-2 size-4" />
                  {t('actions.mtFill')}
                </Button>

                {Object.values(selectedKeys).some(Boolean) ? (
                  <Button className="h-9" onClick={batchApprove}>
                    {t('actions.batchApprove')}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('table.title')}</CardTitle>
              <div className="text-sm text-muted-foreground">
                {t('table.count', { count: visibleEntries.length })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 pt-0">
            {visibleEntries.length === 0 ? (
              <div className="rounded-lg border border-border bg-background p-6 text-sm">
                <div className="font-medium text-foreground">{t('table.emptyTitle')}</div>
                <div className="mt-1 text-muted-foreground">{t('table.emptyDesc')}</div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto scrollbar-hover">
                <table className="w-full min-w-[1040px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-[260px]" />
                    <col className="w-[34%]" />
                    <col className="w-[34%]" />
                    <col className="w-[120px]" />
                    <col className="w-[160px]" />
                    <col className="w-[96px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 text-left font-medium">
                        <span className="sr-only">{t('table.select')}</span>
                      </th>
                      <th className="py-2 pr-3 text-left font-medium">{t('table.colKey')}</th>
                      <th className="py-2 pr-3 text-left font-medium">{t('table.colSource')}</th>
                      <th className="py-2 pr-3 text-left font-medium">{t('table.colTarget')}</th>
                      <th className="py-2 pr-3 text-left font-medium">{t('table.colStatus')}</th>
                      <th className="py-2 pr-3 text-left font-medium">{t('table.colUpdated')}</th>
                      <th className="py-2 pr-3 text-left font-medium">{t('table.colOperations')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((e) => {
                      const tr = getTranslation(e);
                      const draft = getDraft(e);
                      const dirty = isDirty(e);
                      const meta = statusMeta(tr.status);
                      const isHighlighted = highlightKey && e.key === highlightKey;
                      const placements = placementToLabels(e.placements);

                      return (
                        <tr
                          key={e.key}
                          ref={(el) => {
                            rowRefs.current[e.key] = el;
                          }}
                          className={cn(
                            'border-b border-border align-top',
                            isHighlighted && 'bg-accent/60'
                          )}
                        >
                          <td className="py-3 pr-3">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-border bg-background text-primary accent-primary"
                              checked={Boolean(selectedKeys[e.key])}
                              onChange={(ev) =>
                                setSelectedKeys((prev) => ({ ...prev, [e.key]: ev.target.checked }))
                              }
                              aria-label={t('table.selectOne')}
                            />
                          </td>

                          <td className="py-3 pr-3">
                            <button
                              type="button"
                              onClick={() => setDetailsKey(e.key)}
                              className="group inline-flex w-full items-center gap-2 text-left"
                            >
                              <span className="truncate font-medium text-foreground group-hover:underline">
                                {e.key}
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                <ChevronRight className="size-4" />
                              </span>
                            </button>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {placements.slice(0, 2).join(' · ')}
                              {placements.length > 2 ? ` · +${placements.length - 2}` : ''}
                            </div>
                          </td>

                          <td className="py-3 pr-3">
                            <div className="whitespace-pre-wrap break-words text-foreground">{e.source}</div>
                          </td>

                          <td className="py-3 pr-3">
                            <textarea
                              value={draft}
                              onChange={(ev) =>
                                setDrafts((prev) => ({ ...prev, [e.key]: ev.target.value }))
                              }
                              onInput={(ev) => {
                                const el = ev.currentTarget;
                                el.style.height = '0px';
                                el.style.height = `${el.scrollHeight}px`;
                              }}
                              ref={(el) => {
                                if (!el) return;
                                el.style.height = '0px';
                                el.style.height = `${el.scrollHeight}px`;
                              }}
                              placeholder={t('table.targetPlaceholder')}
                              className={cn(
                                'min-h-10 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                                dirty && 'border-primary/40'
                              )}
                            />
                            {dirty ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {t('table.dirtyHint')}
                              </div>
                            ) : null}
                          </td>

                          <td className="py-3 pr-3">
                            <StatusPill status={tr.status} label={t(meta.i18nKey)} />
                          </td>

                          <td className="py-3 pr-3">
                            <div className="text-foreground">{formatDateTime(tr.updatedAt)}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {tr.updatedBy ? t('table.updatedBy', { name: tr.updatedBy }) : '—'}
                            </div>
                          </td>

                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <Button size="icon" disabled={!dirty} onClick={() => trySave(e.key)} aria-label={t('table.save')}>
                                <Save className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                disabled={!dirty}
                                onClick={() => resetDraft(e.key)}
                                aria-label={t('table.reset')}
                              >
                                <RotateCcw className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDetailsKey(e.key)}
                                aria-label={t('details.title')}
                              >
                                <ChevronRight className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(conflict)} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">{t('conflict.title')}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{t('conflict.desc')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
            <div className="font-medium">{conflict?.key}</div>
            <div className="mt-2 text-xs text-muted-foreground">{t('conflict.hint')}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflict(null)}>
              {t('conflict.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!conflict) return;
                const now = new Date().toISOString();
                setEntries((prev) =>
                  prev.map((e) => {
                    if (e.key !== conflict.key) return e;
                    const tr = getTranslation(e);
                    return {
                      ...e,
                      translations: {
                        ...e.translations,
                        [locale]: { ...tr, status: 'updated', updatedAt: now, updatedBy: 'Remote' }
                      }
                    };
                  })
                );
                setDrafts((prev) => ({ ...prev, [conflict.key]: conflict.keepDraft }));
                setConflict(null);
                toast.push({ title: t('toast.refreshedTitle'), message: t('toast.refreshedMessage'), variant: 'default' });
              }}
            >
              <RefreshCcw className="mr-2 size-4" />
              {t('conflict.refreshKeepDraft')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailsKey)} onOpenChange={(open) => !open && setDetailsKey('')}>
        <DialogContent
          className={cn(
            'h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[720px] translate-x-0 translate-y-0 left-auto right-4 top-4 rounded-xl',
            'data-[state=open]:slide-in-from-right-2 data-[state=closed]:slide-out-to-right-2'
          )}
        >
          {(() => {
            const entry = entries.find((e) => e.key === detailsKey);
            if (!entry) return null;
            const tr = locale ? getTranslation(entry) : null;
            const placements = placementToLabels(entry.placements);
            const glossaryTips = [
              { type: 'forced', source: 'Locale', target: 'Locale' },
              { type: 'recommended', source: 'Entry', target: 'Entry' }
            ];

            return (
              <div className="flex h-full flex-col">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold text-foreground">{t('details.title')}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {t('details.desc')}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-2 flex-1 overflow-y-auto">
                  <div className="grid gap-3">
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-xs text-muted-foreground">{t('details.key')}</div>
                      <div className="mt-1 break-all font-medium text-foreground">{entry.key}</div>
                      <div className="mt-3 text-xs text-muted-foreground">{t('details.source')}</div>
                      <div className="mt-1 text-sm text-foreground">{entry.source}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {tr ? <StatusPill status={tr.status} label={t(statusMeta(tr.status).i18nKey)} /> : null}
                        {tr?.updatedAt ? (
                          <span className="text-xs text-muted-foreground">{formatDateTime(tr.updatedAt)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground">{t('details.placements')}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{t('details.placementsHint')}</div>
                        </div>
                        <Button
                          asChild
                          variant="outline"
                          className="h-8 px-2"
                        >
                          <Link href={`/projects/${projectId}/context`}>
                            {t('details.goContext')}
                            <ExternalLink className="ml-2 size-4" />
                          </Link>
                        </Button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {placements.map((p) => (
                          <div key={p} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                            <div className="min-w-0 truncate text-sm text-foreground">{p}</div>
                            <Button
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => {
                                toast.push({ title: t('toast.linkTitle'), message: t('toast.linkMessage'), variant: 'default' });
                              }}
                            >
                              <ExternalLink className="size-4" />
                              <span className="ml-1">{t('details.open')}</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-sm font-medium text-foreground">{t('details.glossary')}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{t('details.glossaryHint')}</div>
                      <div className="mt-3 space-y-2">
                        {glossaryTips.map((g) => (
                          <div key={`${g.type}-${g.source}`} className="rounded-lg border border-border bg-card p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-foreground">{g.source}</div>
                              <span
                                className={cn(
                                  'rounded-md border px-2 py-0.5 text-xs',
                                  g.type === 'forced'
                                    ? 'border-destructive/30 bg-destructive/10 text-foreground'
                                    : 'border-border bg-muted text-foreground'
                                )}
                              >
                                {g.type === 'forced' ? t('details.glossaryForced') : t('details.glossaryRecommended')}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {t('details.glossaryTo', { target: g.target })}
                            </div>
                          </div>
                        ))}
                        <Button asChild variant="outline" className="w-fit">
                          <Link href={`/projects/${projectId}/glossary`}>
                            {t('details.goGlossary')}
                            <ExternalLink className="ml-2 size-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setDetailsKey('')}>
                    {t('details.close')}
                  </Button>
                  <Button
                    onClick={() => {
                      const entryNow = entries.find((e) => e.key === detailsKey);
                      if (!entryNow) return;
                      const draft = getDraft(entryNow);
                      if (draft !== getTranslation(entryNow).target) {
                        trySave(entryNow.key);
                      } else {
                        toast.push({ title: t('toast.noChangeTitle'), message: t('toast.noChangeMessage'), variant: 'default' });
                      }
                    }}
                  >
                    <Save className="mr-2 size-4" />
                    {t('details.save')}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
