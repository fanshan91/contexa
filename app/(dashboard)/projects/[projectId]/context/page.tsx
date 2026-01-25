'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Hash,
  LayoutTemplate,
  Link2,
  Plus,
  RefreshCcw,
  Search,
  Trash2
} from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

type EnvTag = 'dev' | 'test';

type Entry = {
  key: string;
  sourceSnapshot?: string;
  lastSeenAt?: string;
};

type PageNode = {
  id: string;
  route: string;
  title?: string;
  env?: EnvTag;
  lastSyncAt?: string;
  description: string;
  modules: ModuleNode[];
};

type ModuleNode = {
  id: string;
  pageId: string;
  name: string;
  lastSyncAt?: string;
  description: string;
};

type SelectedNode =
  | { type: 'page'; pageId: string }
  | { type: 'module'; pageId: string; moduleId: string };

type PageBindings = {
  pageId: string;
  entries: Entry[];
  collectedKeys: Entry[];
};

type ModuleBindings = {
  moduleId: string;
  entries: Entry[];
  collectedKeys: Entry[];
};

function formatCompactTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function normalizeKey(key: string) {
  return key.trim();
}

function createMockData(projectId: number) {
  const now = Date.now();
  const toIso = (offsetMinutes: number) =>
    new Date(now - offsetMinutes * 60 * 1000).toISOString();

  const allEntries: Entry[] = [
    {
      key: 'common.save',
      sourceSnapshot: '保存',
      lastSeenAt: toIso(35)
    },
    {
      key: 'common.cancel',
      sourceSnapshot: '取消',
      lastSeenAt: toIso(41)
    },
    {
      key: 'auth.signIn.title',
      sourceSnapshot: '登录',
      lastSeenAt: toIso(90)
    },
    {
      key: 'project.settings.basic.title',
      sourceSnapshot: '基本设置',
      lastSeenAt: toIso(52)
    },
    {
      key: 'workbench.filter.untranslated',
      sourceSnapshot: '未翻译',
      lastSeenAt: toIso(12)
    },
    {
      key: 'workbench.filter.review',
      sourceSnapshot: '待审校',
      lastSeenAt: toIso(18)
    },
    {
      key: 'context.pageTree.search.placeholder',
      sourceSnapshot: '搜索路由/标题/模块',
      lastSeenAt: toIso(8)
    },
    {
      key: 'glossary.term.add',
      sourceSnapshot: '添加术语',
      lastSeenAt: toIso(140)
    },
    {
      key: 'glossary.term.delete',
      sourceSnapshot: '删除术语',
      lastSeenAt: toIso(155)
    },
    {
      key: 'project.members.invite',
      sourceSnapshot: '邀请成员',
      lastSeenAt: toIso(210)
    }
  ];

  const pages: PageNode[] = [
    {
      id: `p-${projectId}-home`,
      route: '/dashboard',
      title: '项目列表',
      env: 'dev',
      lastSyncAt: toIso(25),
      description:
        '项目入口页，用户在此查看项目列表并进入具体项目。描述请覆盖术语、风格与语气偏好。',
      modules: [
        {
          id: `m-${projectId}-home-list`,
          pageId: `p-${projectId}-home`,
          name: '项目卡片列表',
          lastSyncAt: toIso(25),
          description:
            '列表中包含项目名、源语言与词条数量等信息。强调信息密度与可扫读性。'
        },
        {
          id: `m-${projectId}-home-toolbar`,
          pageId: `p-${projectId}-home`,
          name: '工具栏',
          lastSyncAt: toIso(25),
          description: '包含新建项目等关键操作入口。'
        }
      ]
    },
    {
      id: `p-${projectId}-workbench`,
      route: `/projects/${projectId}/workbench`,
      title: '翻译工作台',
      env: 'test',
      lastSyncAt: toIso(70),
      description: '按页面/模块语境聚合后开展翻译与审校。',
      modules: [
        {
          id: `m-${projectId}-workbench-filter`,
          pageId: `p-${projectId}-workbench`,
          name: '筛选区',
          lastSyncAt: toIso(70),
          description: '支持按状态、语言与范围进行筛选。'
        },
        {
          id: `m-${projectId}-workbench-table`,
          pageId: `p-${projectId}-workbench`,
          name: '词条列表',
          lastSyncAt: toIso(70),
          description: '展示 Key、源文案与译文等字段，支持冲突提示。'
        }
      ]
    },
    {
      id: `p-${projectId}-settings`,
      route: `/projects/${projectId}/settings`,
      title: '项目设置',
      env: 'dev',
      lastSyncAt: undefined,
      description: '管理语言、成员与质量策略等配置。',
      modules: [
        {
          id: `m-${projectId}-settings-nav`,
          pageId: `p-${projectId}-settings`,
          name: '设置导航',
          lastSyncAt: undefined,
          description: '用于在多个设置面板之间切换。'
        }
      ]
    }
  ];

  const pageBindings: Record<string, PageBindings> = {
    [`p-${projectId}-home`]: {
      pageId: `p-${projectId}-home`,
      entries: [allEntries[0], allEntries[1], allEntries[5]],
      collectedKeys: [allEntries[0], allEntries[1], allEntries[4], allEntries[5]]
    },
    [`p-${projectId}-workbench`]: {
      pageId: `p-${projectId}-workbench`,
      entries: [allEntries[4], allEntries[5], allEntries[0], allEntries[1]],
      collectedKeys: [
        allEntries[4],
        allEntries[5],
        allEntries[0],
        allEntries[1],
        allEntries[2]
      ]
    },
    [`p-${projectId}-settings`]: {
      pageId: `p-${projectId}-settings`,
      entries: [],
      collectedKeys: [allEntries[3], allEntries[9]]
    }
  };

  const moduleBindings: Record<string, ModuleBindings> = {
    [`m-${projectId}-home-list`]: {
      moduleId: `m-${projectId}-home-list`,
      entries: [allEntries[0], allEntries[1]],
      collectedKeys: [allEntries[0], allEntries[1], allEntries[7]]
    },
    [`m-${projectId}-home-toolbar`]: {
      moduleId: `m-${projectId}-home-toolbar`,
      entries: [allEntries[0]],
      collectedKeys: [allEntries[0]]
    },
    [`m-${projectId}-workbench-filter`]: {
      moduleId: `m-${projectId}-workbench-filter`,
      entries: [allEntries[4], allEntries[5]],
      collectedKeys: [allEntries[4], allEntries[5]]
    },
    [`m-${projectId}-workbench-table`]: {
      moduleId: `m-${projectId}-workbench-table`,
      entries: [allEntries[4], allEntries[5], allEntries[2]],
      collectedKeys: [allEntries[4], allEntries[5]]
    },
    [`m-${projectId}-settings-nav`]: {
      moduleId: `m-${projectId}-settings-nav`,
      entries: [],
      collectedKeys: [allEntries[3]]
    }
  };

  return {
    pages,
    pageBindings,
    moduleBindings,
    entryPool: allEntries,
    enhanced: {
      enabled: true,
      licenseOk: true,
      sdkConnected: true
    }
  };
}

function SmallTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border border-border bg-secondary px-2 text-xs text-secondary-foreground">
      {children}
    </span>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}

function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={cn(
            'h-4 rounded-md bg-muted',
            idx === 0 ? 'w-2/3' : idx === 1 ? 'w-5/6' : 'w-1/2'
          )}
        />
      ))}
    </div>
  );
}

function Textarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex min-h-24 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  );
}

export default function ProjectContextPage() {
  const t = useTranslations('projectContext');
  const { push } = useToast();
  const params = useParams();
  const projectIdRaw = Array.isArray(params?.projectId)
    ? params.projectId[0]
    : params?.projectId;
  const projectId = Number(projectIdRaw);
  const mock = useMemo(
    () => (Number.isFinite(projectId) ? createMockData(projectId) : null),
    [projectId]
  );

  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pages, setPages] = useState<PageNode[]>([]);
  const [pageBindings, setPageBindings] = useState<Record<string, PageBindings>>({});
  const [moduleBindings, setModuleBindings] = useState<Record<string, ModuleBindings>>({});
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [expandedPageIds, setExpandedPageIds] = useState<Set<string>>(() => new Set());

  const [treeQuery, setTreeQuery] = useState('');
  const [entriesQuery, setEntriesQuery] = useState('');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'page' | 'module'>('page');
  const [createDraft, setCreateDraft] = useState({
    route: '',
    title: '',
    moduleName: ''
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [poolQuery, setPoolQuery] = useState('');

  const [selectedEntryKeys, setSelectedEntryKeys] = useState<Set<string>>(
    () => new Set()
  );

  const enhanced = mock?.enhanced ?? {
    enabled: false,
    licenseOk: false,
    sdkConnected: false
  };

  useEffect(() => {
    if (!Number.isFinite(projectId) || !mock) {
      setDataState('error');
      return;
    }

    setDataState('loading');
    const timer = window.setTimeout(() => {
      setPages(mock.pages);
      setPageBindings(mock.pageBindings);
      setModuleBindings(mock.moduleBindings);
      setExpandedPageIds(new Set(mock.pages.map((p) => p.id)));
      setSelected(mock.pages.length > 0 ? { type: 'page', pageId: mock.pages[0]!.id } : null);
      setDataState('ready');
    }, 250);

    return () => window.clearTimeout(timer);
  }, [mock, projectId]);

  const selection = useMemo(() => {
    if (!selected) return null;
    const page = pages.find((p) => p.id === selected.pageId) ?? null;
    if (!page) return null;

    if (selected.type === 'page') {
      return {
        type: 'page' as const,
        page,
        module: null as ModuleNode | null
      };
    }

    const module = page.modules.find((m) => m.id === selected.moduleId) ?? null;
    return {
      type: 'module' as const,
      page,
      module
    };
  }, [pages, selected]);

  const boundEntries = useMemo(() => {
    if (!selection) return [] as Entry[];
    if (selection.type === 'page') {
      return pageBindings[selection.page.id]?.entries ?? [];
    }
    if (!selection.module) return [];
    return moduleBindings[selection.module.id]?.entries ?? [];
  }, [moduleBindings, pageBindings, selection]);

  const filteredBoundEntries = useMemo(() => {
    const q = entriesQuery.trim().toLowerCase();
    if (!q) return boundEntries;
    return boundEntries.filter((e) => e.key.toLowerCase().includes(q));
  }, [boundEntries, entriesQuery]);

  const selectedEntryCount = selectedEntryKeys.size;
  const allVisibleSelected =
    filteredBoundEntries.length > 0 &&
    filteredBoundEntries.every((e) => selectedEntryKeys.has(e.key));

  const nodeKeyCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pages) {
      map.set(p.id, pageBindings[p.id]?.entries.length ?? 0);
      for (const m of p.modules) {
        map.set(m.id, moduleBindings[m.id]?.entries.length ?? 0);
      }
    }
    return map;
  }, [moduleBindings, pageBindings, pages]);

  const selectedKeyCount = useMemo(() => {
    if (!selection) return 0;
    if (selection.type === 'page') return nodeKeyCount.get(selection.page.id) ?? 0;
    if (!selection.module) return 0;
    return nodeKeyCount.get(selection.module.id) ?? 0;
  }, [nodeKeyCount, selection]);

  const selectedEnv = useMemo(() => {
    if (!selection) return undefined;
    return selection.page.env;
  }, [selection]);

  const filteredPages = useMemo(() => {
    const q = treeQuery.trim().toLowerCase();
    if (!q) return pages;

    return pages
      .map((p) => {
        const pageHit =
          p.route.toLowerCase().includes(q) ||
          (p.title ?? '').toLowerCase().includes(q);
        const modules = p.modules.filter((m) => m.name.toLowerCase().includes(q));
        if (pageHit) return p;
        if (modules.length === 0) return null;
        return { ...p, modules };
      })
      .filter(Boolean) as PageNode[];
  }, [pages, treeQuery]);

  const currentNodeLastSyncAt = useMemo(() => {
    if (!selection) return undefined;
    if (selection.type === 'page') return selection.page.lastSyncAt;
    return selection.module?.lastSyncAt;
  }, [selection]);

  const selectedNodeName = useMemo(() => {
    if (!selection) return '';
    if (selection.type === 'page') return t('nodeType.page');
    return `${t('nodeType.module')} · ${selection.module?.name ?? '-'}`;
  }, [selection, t]);

  const openCreateDialog = (type: 'page' | 'module') => {
    setCreateType(type);
    setCreateDraft({ route: '', title: '', moduleName: '' });
    setCreateDialogOpen(true);
  };

  const canCreateModule = dataState === 'ready' && selection?.type === 'page';
  const createPrimaryDisabled =
    createType === 'page'
      ? normalizeKey(createDraft.route).length === 0
      : normalizeKey(createDraft.moduleName).length === 0;

  const handleCreate = () => {
    if (createType === 'page') {
      const route = normalizeKey(createDraft.route);
      if (!route) return;
      const id = `p-${projectId}-${Math.random().toString(16).slice(2)}`;
      const newPage: PageNode = {
        id,
        route,
        title: createDraft.title.trim() || undefined,
        env: 'dev',
        lastSyncAt: undefined,
        description: '',
        modules: []
      };
      setPages((prev) => [newPage, ...prev]);
      setPageBindings((prev) => ({
        ...prev,
        [id]: { pageId: id, entries: [], collectedKeys: [] }
      }));
      setExpandedPageIds((prev) => new Set([...prev, id]));
      setSelected({ type: 'page', pageId: id });
      setCreateDialogOpen(false);
      push({ variant: 'default', message: t('toast.pageCreated') });
      return;
    }

    if (!selection || selection.type !== 'page') return;
    const name = createDraft.moduleName.trim();
    if (!name) return;
    const moduleId = `m-${projectId}-${Math.random().toString(16).slice(2)}`;
    const newModule: ModuleNode = {
      id: moduleId,
      pageId: selection.page.id,
      name,
      lastSyncAt: undefined,
      description: ''
    };
    setPages((prev) =>
      prev.map((p) =>
        p.id === selection.page.id ? { ...p, modules: [newModule, ...p.modules] } : p
      )
    );
    setModuleBindings((prev) => ({
      ...prev,
      [moduleId]: { moduleId, entries: [], collectedKeys: [] }
    }));
    setSelected({ type: 'module', pageId: selection.page.id, moduleId });
    setCreateDialogOpen(false);
    push({ variant: 'default', message: t('toast.moduleCreated') });
  };

  const handleDeleteSelected = () => {
    if (!selection) return;
    if (selection.type === 'page') {
      const pageId = selection.page.id;
      const moduleIds = selection.page.modules.map((m) => m.id);
      setPages((prev) => {
        const nextPages = prev.filter((p) => p.id !== pageId);
        const nextSelected =
          nextPages.length > 0 ? ({ type: 'page', pageId: nextPages[0]!.id } as const) : null;
        setSelected(nextSelected);
        setSelectedEntryKeys(new Set());
        return nextPages;
      });
      setPageBindings((prev) => {
        const next = { ...prev };
        delete next[pageId];
        return next;
      });
      setModuleBindings((prev) => {
        const next = { ...prev };
        for (const id of moduleIds) delete next[id];
        return next;
      });
      setDeleteDialogOpen(false);
      push({ variant: 'default', message: t('toast.pageDeleted') });
      return;
    }

    const moduleId = selection.module?.id;
    const pageId = selection.page.id;
    if (!moduleId) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, modules: p.modules.filter((m) => m.id !== moduleId) }
          : p
      )
    );
    setModuleBindings((prev) => {
      const next = { ...prev };
      delete next[moduleId];
      return next;
    });
    setSelected({ type: 'page', pageId });
    setDeleteDialogOpen(false);
    push({ variant: 'default', message: t('toast.moduleDeleted') });
  };

  const isSelected = (node: SelectedNode) => {
    if (!selected) return false;
    if (node.type !== selected.type) return false;
    if (node.pageId !== selected.pageId) return false;
    if (node.type === 'module' && selected.type === 'module') {
      return node.moduleId === selected.moduleId;
    }
    return node.type === 'page' && selected.type === 'page';
  };

  const toggleExpand = (pageId: string) => {
    setExpandedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const updateSelectedDescription = (next: string) => {
    if (!selection) return;
    if (selection.type === 'page') {
      setPages((prev) =>
        prev.map((p) => (p.id === selection.page.id ? { ...p, description: next } : p))
      );
      return;
    }
    if (!selection.module) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id !== selection.page.id
          ? p
          : {
              ...p,
              modules: p.modules.map((m) =>
                m.id === selection.module!.id ? { ...m, description: next } : m
              )
            }
      )
    );
  };

  const saveDescription = () => {
    push({ variant: 'default', message: t('toast.descriptionSaved') });
  };

  const clearEntrySelection = () => setSelectedEntryKeys(new Set());

  const toggleEntrySelected = (key: string) => {
    setSelectedEntryKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllVisibleEntries = () => {
    setSelectedEntryKeys((prev) => {
      const next = new Set(prev);
      const allSelected =
        filteredBoundEntries.length > 0 &&
        filteredBoundEntries.every((e) => next.has(e.key));
      if (allSelected) {
        for (const e of filteredBoundEntries) next.delete(e.key);
      } else {
        for (const e of filteredBoundEntries) next.add(e.key);
      }
      return next;
    });
  };

  const unbindEntries = (keys: string[], options?: { silent?: boolean }) => {
    if (!selection) return;
    const keySet = new Set(keys);
    if (selection.type === 'page') {
      setPageBindings((prev) => {
        const current = prev[selection.page.id];
        if (!current) return prev;
        return {
          ...prev,
          [selection.page.id]: {
            ...current,
            entries: current.entries.filter((e) => !keySet.has(e.key))
          }
        };
      });
    } else if (selection.module) {
      setModuleBindings((prev) => {
        const current = prev[selection.module!.id];
        if (!current) return prev;
        return {
          ...prev,
          [selection.module!.id]: {
            ...current,
            entries: current.entries.filter((e) => !keySet.has(e.key))
          }
        };
      });
    }
    clearEntrySelection();
    if (!options?.silent) {
      push({
        variant: 'default',
        message: t('toast.unbound', { count: keys.length })
      });
    }
  };

  const bindEntries = (entries: Entry[], options?: { silent?: boolean }) => {
    if (!selection) return;
    const toAdd = entries.filter((e) => !!normalizeKey(e.key));
    if (toAdd.length === 0) return;
    if (selection.type === 'page') {
      setPageBindings((prev) => {
        const current = prev[selection.page.id] ?? {
          pageId: selection.page.id,
          entries: [],
          collectedKeys: []
        };
        const existing = new Set(current.entries.map((e) => e.key));
        return {
          ...prev,
          [selection.page.id]: {
            ...current,
            entries: [...toAdd.filter((e) => !existing.has(e.key)), ...current.entries]
          }
        };
      });
    } else if (selection.module) {
      setModuleBindings((prev) => {
        const current = prev[selection.module!.id] ?? {
          moduleId: selection.module!.id,
          entries: [],
          collectedKeys: []
        };
        const existing = new Set(current.entries.map((e) => e.key));
        return {
          ...prev,
          [selection.module!.id]: {
            ...current,
            entries: [...toAdd.filter((e) => !existing.has(e.key)), ...current.entries]
          }
        };
      });
    }
    if (!options?.silent) {
      push({
        variant: 'default',
        message: t('toast.bound', { count: toAdd.length })
      });
    }
  };

  const poolCandidates = useMemo(() => {
    if (!mock) return [] as Entry[];
    const q = poolQuery.trim().toLowerCase();
    const currentKeys = new Set(boundEntries.map((e) => e.key));
    return mock.entryPool
      .filter((e) => !currentKeys.has(e.key))
      .filter((e) => (q ? e.key.toLowerCase().includes(q) : true));
  }, [boundEntries, mock, poolQuery]);

  const [poolSelected, setPoolSelected] = useState<Set<string>>(() => new Set());
  const poolAllSelected =
    poolCandidates.length > 0 && poolCandidates.every((e) => poolSelected.has(e.key));
  const togglePoolSelectAll = () => {
    setPoolSelected((prev) => {
      const next = new Set(prev);
      const all =
        poolCandidates.length > 0 && poolCandidates.every((e) => next.has(e.key));
      if (all) {
        for (const e of poolCandidates) next.delete(e.key);
      } else {
        for (const e of poolCandidates) next.add(e.key);
      }
      return next;
    });
  };
  const togglePoolKey = (key: string) => {
    setPoolSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addSelectedPoolEntries = () => {
    if (!mock) return;
    const selectedKeys = new Set(poolSelected);
    const entries = mock.entryPool.filter((e) => selectedKeys.has(e.key));
    bindEntries(entries);
    setPoolSelected(new Set());
    setPoolQuery('');
    setAddEntryDialogOpen(false);
  };

  const syncAvailability = useMemo(() => {
    if (!enhanced.enabled) return { ok: false, reason: t('sync.disabled') };
    if (!enhanced.licenseOk) return { ok: false, reason: t('sync.noLicense') };
    if (!enhanced.sdkConnected) return { ok: false, reason: t('sync.noSdk') };
    return { ok: true, reason: '' };
  }, [enhanced.enabled, enhanced.licenseOk, enhanced.sdkConnected, t]);

  const currentCollectedEntries = useMemo(() => {
    if (!selection) return [] as Entry[];
    if (selection.type === 'page') {
      return pageBindings[selection.page.id]?.collectedKeys ?? [];
    }
    if (!selection.module) return [];
    return moduleBindings[selection.module.id]?.collectedKeys ?? [];
  }, [moduleBindings, pageBindings, selection]);

  const syncDiff = useMemo(() => {
    const bound = boundEntries;
    const collected = currentCollectedEntries;
    const boundMap = new Map(bound.map((e) => [e.key, e]));
    const collectedMap = new Map(collected.map((e) => [e.key, e]));

    const added = collected.filter((e) => !boundMap.has(e.key));
    const missing = bound.filter((e) => !collectedMap.has(e.key));

    return {
      added,
      missing
    };
  }, [boundEntries, currentCollectedEntries]);

  const [syncAddedSelected, setSyncAddedSelected] = useState<Set<string>>(
    () => new Set()
  );
  const [syncMissingUnbind, setSyncMissingUnbind] = useState<Set<string>>(
    () => new Set()
  );

  const openSync = () => {
    setSyncAddedSelected(new Set(syncDiff.added.map((e) => e.key)));
    setSyncMissingUnbind(new Set());
    setSyncDialogOpen(true);
  };

  const applySync = () => {
    if (!selection) return;
    const nowIso = new Date().toISOString();
    const addKeys = new Set(syncAddedSelected);
    const addedEntries = syncDiff.added.filter((e) => addKeys.has(e.key));
    if (addedEntries.length > 0) bindEntries(addedEntries, { silent: true });

    const unbindKeys = Array.from(syncMissingUnbind);
    if (unbindKeys.length > 0) unbindEntries(unbindKeys, { silent: true });

    if (selection.type === 'page') {
      setPages((prev) =>
        prev.map((p) => (p.id === selection.page.id ? { ...p, lastSyncAt: nowIso } : p))
      );
    } else if (selection.module) {
      setPages((prev) =>
        prev.map((p) =>
          p.id !== selection.page.id
            ? p
            : {
                ...p,
                modules: p.modules.map((m) =>
                  m.id === selection.module!.id ? { ...m, lastSyncAt: nowIso } : m
                )
              }
        )
      );
    }

    setSyncDialogOpen(false);
    push({ variant: 'default', message: t('toast.synced') });
  };

  if (!Number.isFinite(projectId)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">
            {t('title')}
          </h1>
          {/* <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p> */}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => openCreateDialog('page')}
            className="shadow-none"
          >
            <Plus className="h-4 w-4" />
            {t('actions.newPage')}
          </Button>
          <Button
            variant="outline"
            onClick={() => openCreateDialog('module')}
            className="shadow-none"
            disabled={!canCreateModule}
          >
            <Plus className="h-4 w-4" />
            {t('actions.newModule')}
          </Button>
          <Button
            variant="outline"
            className="shadow-none"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!selection}
          >
            <Trash2 className="h-4 w-4" />
            {t('actions.delete')}
          </Button>
          <Button asChild variant="outline" className="shadow-none">
            <Link href={`/projects/${projectId}/workbench`}>{t('actions.goWorkbench')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="py-0">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">{t('tree.title')}</CardTitle>
            <CardDescription>{t('tree.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={treeQuery}
                onChange={(e) => setTreeQuery(e.target.value)}
                placeholder={t('tree.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <div className="mt-3 max-h-[540px] overflow-auto rounded-lg border border-border bg-background">
              {dataState === 'loading' ? (
                <div className="p-4">
                  <LoadingBlock lines={6} />
                </div>
              ) : dataState === 'error' ? (
                <div className="p-4">
                  <EmptyState title={t('state.errorTitle')} desc={t('state.errorDesc')} />
                </div>
              ) : filteredPages.length === 0 ? (
                <div className="p-4">
                  {treeQuery.trim() ? (
                    <div className="text-sm text-muted-foreground">{t('tree.emptySearch')}</div>
                  ) : (
                    <EmptyState title={t('state.noDataTitle')} desc={t('state.noDataDesc')} />
                  )}
                </div>
              ) : (
                <div className="p-1">
                  {filteredPages.map((page) => {
                    const expanded = expandedPageIds.has(page.id);
                    const pageNode: SelectedNode = { type: 'page', pageId: page.id };
                    return (
                      <div key={page.id} className="py-0.5">
                        <div className="flex items-start gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => toggleExpand(page.id)}
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="sr-only">{t('tree.toggle')}</span>
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(pageNode);
                              setSelectedEntryKeys(new Set());
                            }}
                            className={cn(
                              'flex-1 rounded-lg border px-3 py-2 text-left transition-colors',
                              isSelected(pageNode)
                                ? 'border-primary/30 bg-accent/40'
                                : 'border-transparent hover:bg-accent/30'
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {page.title ? page.title : t('tree.untitledPage')}
                                  </div>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Link2 className="h-3.5 w-3.5" />
                                    <span className="truncate">{page.route}</span>
                                  </span>
                                  {page.lastSyncAt ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5" />
                                      {formatCompactTime(page.lastSyncAt)}
                                    </span>
                                  ) : null}
                                  <span className="inline-flex items-center gap-1">
                                    <Hash className="h-3.5 w-3.5" />
                                    {t('tree.keyCount', {
                                      count: nodeKeyCount.get(page.id) ?? 0
                                    })}
                                  </span>
                                </div>
                              </div>
                              {page.env ? <SmallTag>{page.env}</SmallTag> : null}
                            </div>
                          </button>
                        </div>

                        {expanded ? (
                          <div className="mt-1 space-y-1 pl-10">
                            {page.modules.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                                {t('tree.noModules')}
                              </div>
                            ) : (
                              page.modules.map((m) => {
                                const moduleNode: SelectedNode = {
                                  type: 'module',
                                  pageId: page.id,
                                  moduleId: m.id
                                };
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setSelected(moduleNode);
                                      setSelectedEntryKeys(new Set());
                                    }}
                                    className={cn(
                                      'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                                      isSelected(moduleNode)
                                        ? 'border-primary/30 bg-accent/40'
                                        : 'border-transparent hover:bg-accent/30'
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-foreground">
                                          {m.name}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                          {m.lastSyncAt ? (
                                            <span className="inline-flex items-center gap-1">
                                              <Clock className="h-3.5 w-3.5" />
                                              {formatCompactTime(m.lastSyncAt)}
                                            </span>
                                          ) : null}
                                          <span className="inline-flex items-center gap-1">
                                            <Hash className="h-3.5 w-3.5" />
                                            {t('tree.keyCount', {
                                              count: nodeKeyCount.get(m.id) ?? 0
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                      <SmallTag>{t('tree.moduleTag')}</SmallTag>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {dataState === 'loading' ? (
            <Card className="py-0">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-base">{t('state.loadingTitle')}</CardTitle>
                <CardDescription>{t('state.loadingDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <LoadingBlock lines={5} />
              </CardContent>
            </Card>
          ) : dataState === 'error' ? (
            <EmptyState title={t('state.errorTitle')} desc={t('state.errorDesc')} />
          ) : !selection ? (
            <EmptyState title={t('detail.noSelectionTitle')} desc={t('detail.noSelectionDesc')} />
          ) : (
            <>
              <Card className="py-0">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-base">{t('detail.title')}</CardTitle>
                  <CardDescription>{t('detail.subtitle')}</CardDescription>
                  <CardAction>
                    <Button
                      variant="outline"
                      className="shadow-none"
                      disabled={!syncAvailability.ok}
                      onClick={openSync}
                      title={syncAvailability.ok ? undefined : syncAvailability.reason}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      {t('sync.button')}
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">{t('detail.pageTitle')}</div>
                      <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                        {selection.page.title ? selection.page.title : t('tree.untitledPage')}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">{t('detail.route')}</div>
                      <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                        {selection.page.route}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">{t('detail.selectedNode')}</div>
                      <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                        {selectedNodeName}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">{t('detail.env')}</div>
                      <div className="mt-0.5 text-sm font-medium text-foreground">
                        {selectedEnv ? selectedEnv : t('detail.envUnknown')}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">{t('detail.keyCount')}</div>
                      <div className="mt-0.5 text-sm font-medium text-foreground">
                        {t('detail.keyCountValue', { count: selectedKeyCount })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">{t('detail.lastSync')}</div>
                      <div className="mt-0.5 text-sm font-medium text-foreground">
                        {currentNodeLastSyncAt
                          ? formatCompactTime(currentNodeLastSyncAt)
                          : t('detail.notSynced')}
                      </div>
                    </div>
                  </div>
                  {syncAvailability.ok ? null : (
                    <div className="mt-3 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                      {syncAvailability.reason}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="py-0">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-base">{t('description.title')}</CardTitle>
                  <CardDescription>{t('description.subtitle')}</CardDescription>
                  <CardAction>
                    <Button
                      variant="outline"
                      className="shadow-none"
                      onClick={saveDescription}
                    >
                      <Check className="h-4 w-4" />
                      {t('description.save')}
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Textarea
                    value={
                      selection.type === 'page'
                        ? selection.page.description
                        : selection.module?.description ?? ''
                    }
                    onChange={(e) => updateSelectedDescription(e.target.value)}
                    placeholder={t('description.placeholder')}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('description.hint')}
                  </div>
                </CardContent>
              </Card>

              <Card className="py-0">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-base">{t('entries.title')}</CardTitle>
                  <CardDescription>{t('entries.subtitle')}</CardDescription>
                  <CardAction>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="shadow-none"
                        onClick={() => {
                          setPoolSelected(new Set());
                          setPoolQuery('');
                          setAddEntryDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {t('entries.add')}
                      </Button>
                      <Button
                        variant="outline"
                        className="shadow-none"
                        disabled={selectedEntryCount === 0}
                        onClick={() => unbindEntries(Array.from(selectedEntryKeys))}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('entries.unbind')}
                        {selectedEntryCount > 0 ? (
                          <SmallTag>{selectedEntryCount}</SmallTag>
                        ) : null}
                      </Button>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-md">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={entriesQuery}
                        onChange={(e) => setEntriesQuery(e.target.value)}
                        placeholder={t('entries.searchPlaceholder')}
                        className="pl-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisibleEntries}
                          className="h-4 w-4 rounded border border-input bg-background text-primary"
                        />
                        {t('entries.selectAll')}
                      </label>
                      {selectedEntryCount > 0 ? (
                        <Button
                          variant="ghost"
                          className="h-9 px-3 shadow-none"
                          onClick={clearEntrySelection}
                        >
                          {t('entries.clearSelection')}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[40px_1.3fr_1.7fr_140px] gap-0 border-b border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground">
                      <div className="flex items-center justify-center">#</div>
                      <div>{t('entries.columns.key')}</div>
                      <div>{t('entries.columns.snapshot')}</div>
                      <div className="text-right">{t('entries.columns.lastSeen')}</div>
                    </div>

                    {filteredBoundEntries.length === 0 ? (
                      <div className="p-4">
                        <EmptyState
                          title={t('entries.emptyTitle')}
                          desc={t('entries.emptyDesc')}
                        />
                      </div>
                    ) : (
                      <div className="max-h-[420px] overflow-auto">
                        {filteredBoundEntries.map((e) => (
                          <div
                            key={e.key}
                            className="grid grid-cols-[40px_1.3fr_1.7fr_140px] items-start gap-0 border-b border-border px-3 py-2 last:border-b-0"
                          >
                            <div className="flex items-start justify-center pt-0.5">
                              <input
                                type="checkbox"
                                checked={selectedEntryKeys.has(e.key)}
                                onChange={() => toggleEntrySelected(e.key)}
                                className="h-4 w-4 rounded border border-input bg-background text-primary"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {e.key}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm text-muted-foreground">
                                {e.sourceSnapshot ? e.sourceSnapshot : '-'}
                              </div>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              {e.lastSeenAt ? formatCompactTime(e.lastSeenAt) : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {createType === 'page' ? t('create.pageTitle') : t('create.moduleTitle')}
            </DialogTitle>
          </DialogHeader>
          {createType === 'page' ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="route">{t('create.route')}</Label>
                <Input
                  id="route"
                  value={createDraft.route}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, route: e.target.value }))}
                  placeholder={t('create.routePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">{t('create.pageName')}</Label>
                <Input
                  id="title"
                  value={createDraft.title}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, title: e.target.value }))}
                  placeholder={t('create.pageNamePlaceholder')}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                {canCreateModule
                  ? t('create.moduleUnder', {
                      page: selection?.page.title ? selection.page.title : selection?.page.route
                    })
                  : t('create.moduleNeedPage')}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="moduleName">{t('create.moduleName')}</Label>
                <Input
                  id="moduleName"
                  value={createDraft.moduleName}
                  onChange={(e) =>
                    setCreateDraft((p) => ({ ...p, moduleName: e.target.value }))
                  }
                  placeholder={t('create.moduleNamePlaceholder')}
                  disabled={!canCreateModule}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setCreateDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={createPrimaryDisabled || (!canCreateModule && createType === 'module')}>
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('delete.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-secondary-foreground">
              {selection
                ? selection.type === 'page'
                  ? t('delete.pageHint')
                  : t('delete.moduleHint')
                : t('delete.noSelection')}
            </div>
            {selection ? (
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">{t('delete.target')}</div>
                <div className="mt-0.5 font-medium text-foreground">
                  {selection.type === 'page'
                    ? selection.page.title || selection.page.route
                    : selection.module?.name}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteSelected} disabled={!selection}>
              {t('common.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addEntryDialogOpen} onOpenChange={setAddEntryDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('addEntry.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                placeholder={t('addEntry.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={poolAllSelected}
                  onChange={togglePoolSelectAll}
                  className="h-4 w-4 rounded border border-input bg-background text-primary"
                />
                {t('addEntry.selectAll')}
              </label>
              <SmallTag>
                {t('addEntry.selectedCount', { count: poolSelected.size })}
              </SmallTag>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-border bg-background">
              {poolCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t('addEntry.empty')}</div>
              ) : (
                <div className="divide-y divide-border">
                  {poolCandidates.map((e) => (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => togglePoolKey(e.key)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                        poolSelected.has(e.key) ? 'bg-accent/40' : 'hover:bg-accent/30'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={poolSelected.has(e.key)}
                        readOnly
                        className="mt-0.5 h-4 w-4 rounded border border-input bg-background text-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{e.key}</div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          {e.sourceSnapshot ? e.sourceSnapshot : '-'}
                        </div>
                      </div>
                      {e.lastSeenAt ? (
                        <SmallTag>{formatCompactTime(e.lastSeenAt)}</SmallTag>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setAddEntryDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={addSelectedPoolEntries} disabled={poolSelected.size === 0}>
              {t('addEntry.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('sync.dialogTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              {t('sync.summary', {
                add: syncDiff.added.length,
                missing: syncDiff.missing.length
              })}
            </div>

            <div className="rounded-xl border border-border bg-background">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{t('sync.addedTitle')}</div>
                  <div className="text-sm text-muted-foreground">{t('sync.addedDesc')}</div>
                </div>
                <SmallTag>{syncDiff.added.length}</SmallTag>
              </div>
              {syncDiff.added.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">{t('sync.none')}</div>
              ) : (
                <div className="max-h-48 overflow-auto">
                  {syncDiff.added.map((e) => (
                    <label
                      key={e.key}
                      className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={syncAddedSelected.has(e.key)}
                        onChange={() =>
                          setSyncAddedSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(e.key)) next.delete(e.key);
                            else next.add(e.key);
                            return next;
                          })
                        }
                        className="mt-0.5 h-4 w-4 rounded border border-input bg-background text-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{e.key}</div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          {e.sourceSnapshot ? e.sourceSnapshot : '-'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{t('sync.missingTitle')}</div>
                  <div className="text-sm text-muted-foreground">{t('sync.missingDesc')}</div>
                </div>
                <SmallTag>{syncDiff.missing.length}</SmallTag>
              </div>
              {syncDiff.missing.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">{t('sync.none')}</div>
              ) : (
                <div className="max-h-48 overflow-auto">
                  {syncDiff.missing.map((e) => (
                    <label
                      key={e.key}
                      className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={syncMissingUnbind.has(e.key)}
                        onChange={() =>
                          setSyncMissingUnbind((prev) => {
                            const next = new Set(prev);
                            if (next.has(e.key)) next.delete(e.key);
                            else next.add(e.key);
                            return next;
                          })
                        }
                        className="mt-0.5 h-4 w-4 rounded border border-input bg-background text-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{e.key}</div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          {t('sync.missingKeepOrUnbind')}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setSyncDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={applySync} disabled={!syncAvailability.ok}>
              {t('sync.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
