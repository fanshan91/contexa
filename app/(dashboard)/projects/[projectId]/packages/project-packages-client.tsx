'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Download, Plus, RefreshCcw, Eye, Pencil } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog-primitives';
import { RadioGroup } from '@/components/ui/radio-group';
import { Pagination } from '@/components/ui/pagination';
import { Table, type TableColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { TargetLocaleSelect } from '@/components/target-locale-select';
import { cn } from '@/lib/utils';
import {
  importLanguagePackAction,
  exportLanguagePackAction,
  listPackagesEntriesQuery,
  type PackagesEntry
} from './actions';

type TranslationStatus = 'pending' | 'needs_update' | 'needs_review' | 'ready' | 'approved';

type EntryTranslation = {
  text: string;
  status: TranslationStatus;
  updatedAt: number;
};

type Entry = {
  key: string;
  sourceText: string;
  createdAt: number;
  updatedAt: number;
  translations: Record<string, EntryTranslation | undefined>;
};

type UploadSummary = {
  added: number;
  updated: number;
  missingInUpload: number;
  hasUpdate: number;
  pendingReview: number;
  ignored: number;
};

type UploadRecord = {
  id: string;
  createdAt: number;
  locale: string;
  operator: string;
  summary: UploadSummary;
  addedKeys: string[];
  updatedKeys: Array<{ key: string; before: string; after: string }>;
  pendingReviewKeys: string[];
  hasUpdateKeys: string[];
  ignoredKeys: string[];
};

type UpdatedKeyRow = { key: string; before: string; after: string };

type DownloadMode = 'empty' | 'fallback' | 'filled';

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateTime(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function toMs(iso: string) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

function mapEntriesFromServer(items: PackagesEntry[], targetLocales: string[]) {
  const out: Record<string, Entry> = {};
  for (const it of items) {
    const translations: Entry['translations'] = {};
    for (const l of targetLocales) {
      const tr = it.translations[l];
      translations[l] = tr
        ? { text: tr.text ?? '', status: tr.status, updatedAt: toMs(tr.updatedAt) }
        : { text: '', status: 'pending', updatedAt: toMs(it.updatedAt) };
    }
    out[it.key] = {
      key: it.key,
      sourceText: it.sourceText,
      createdAt: toMs(it.createdAt),
      updatedAt: toMs(it.updatedAt),
      translations
    };
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFlatJsonMap(raw: string): { ok: true; value: Record<string, string> } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'JSON 解析失败：请确认文件内容为合法 JSON。' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, message: '结构不符合约定：仅支持扁平 key-value 的 JSON 对象。' };
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== 'string') {
      return { ok: false, message: '结构不符合约定：value 必须为字符串（仅支持扁平 key-value）。' };
    }
    out[k] = v;
  }
  return { ok: true, value: out };
}

function buildMockEntries(sourceLocale: string, targetLocales: string[]) {
  // Use fixed time for hydration consistency
  const now = 1769334000000;
  const seed: Array<{ key: string; sourceText: string; translations?: Record<string, { text: string; status: TranslationStatus }> }> = [
    {
      key: 'nav.home',
      sourceText: '首页',
      translations: {
        'en-US': { text: 'Home', status: 'approved' },
        'ja-JP': { text: 'ホーム', status: 'approved' }
      }
    },
    {
      key: 'auth.signIn',
      sourceText: '登录',
      translations: {
        'en-US': { text: 'Sign in', status: 'approved' },
        'ja-JP': { text: 'ログイン', status: 'needs_review' }
      }
    },
    {
      key: 'auth.signOut',
      sourceText: '退出登录',
      translations: {
        'en-US': { text: 'Sign out', status: 'approved' }
      }
    },
    {
      key: 'common.save',
      sourceText: '保存',
      translations: {
        'en-US': { text: 'Save', status: 'approved' },
        'ja-JP': { text: '', status: 'pending' }
      }
    },
    {
      key: 'common.cancel',
      sourceText: '取消',
      translations: {
        'en-US': { text: 'Cancel', status: 'approved' }
      }
    },
    {
      key: 'project.empty',
      sourceText: '暂无数据',
      translations: {
        'en-US': { text: 'No data', status: 'approved' },
        'ja-JP': { text: 'データがありません', status: 'approved' }
      }
    },
    {
      key: 'packages.uploadHint',
      sourceText: '仅支持扁平 JSON：{"key":"value"}',
      translations: {
        'en-US': { text: 'Only flat JSON is supported: {"key":"value"}', status: 'approved' }
      }
    }
  ];

  const map = new Map<string, Entry>();
  for (const it of seed) {
    const translations: Entry['translations'] = {};
    for (const l of targetLocales) {
      const seeded = it.translations?.[l];
      translations[l] = seeded
        ? { text: seeded.text, status: seeded.status, updatedAt: now - 1000 * 60 * 60 * 12 }
        : { text: '', status: 'pending', updatedAt: now - 1000 * 60 * 60 * 24 };
    }
    map.set(it.key, {
      key: it.key,
      sourceText: it.sourceText,
      createdAt: now - 1000 * 60 * 60 * 24 * 7,
      updatedAt: now - 1000 * 60 * 30,
      translations
    });
  }

  const initial = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  return {
    entriesByKey: Object.fromEntries(initial.map((e) => [e.key, e] as const)) as Record<string, Entry>
  };
}

function StatusPill({ status }: { status: TranslationStatus }) {
  const { label, cls } =
    status === 'approved'
      ? { label: '已审校', cls: 'border-success/30 text-success' }
      : status === 'needs_review' || status === 'ready'
        ? { label: '待审核', cls: 'border-warning/40 text-warning' }
        : status === 'needs_update'
          ? { label: '有更新', cls: 'border-info/30 text-info' }
          : { label: '未翻译', cls: 'border-border text-muted-foreground' };

  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs', cls)}>
      {label}
    </span>
  );
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {desc ? <div className="mt-0.5 text-sm text-muted-foreground">{desc}</div> : null}
    </div>
  );
}

function selectClassName() {
  return 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';
}

export function ProjectPackagesClient({
  projectId,
  variant = 'entries',
  sourceLocale,
  targetLocales,
  templateShape,
  canManage,
  initialEntries,
  bootstrapError,
  entriesError
}: {
  projectId: number;
  variant?: 'entries' | 'ops';
  sourceLocale: string;
  targetLocales: string[];
  templateShape: 'flat' | 'tree';
  canManage: boolean;
  initialEntries: PackagesEntry[];
  bootstrapError: string;
  entriesError: string;
}) {
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allLocales = useMemo(
    () => [sourceLocale, ...targetLocales],
    [sourceLocale, targetLocales]
  );

  const [selectedLocale, setSelectedLocale] = useState(sourceLocale);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadLocale, setDownloadLocale] = useState(sourceLocale);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('fallback');
  const [exportOpen, setExportOpen] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    mapEntriesFromServer(initialEntries, targetLocales)
  );
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [latestRecordId, setLatestRecordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createKeyMode, setCreateKeyMode] = useState<'auto' | 'manual'>('auto');
  const [createAutoKey, setCreateAutoKey] = useState(() => `ctx_${randomId().slice(0, 8)}`);
  const [createKey, setCreateKey] = useState('');
  const [createSourceText, setCreateSourceText] = useState('');
  const [createTargetLocale, setCreateTargetLocale] = useState(targetLocales[0] ?? sourceLocale);
  const [createTargetText, setCreateTargetText] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editSourceText, setEditSourceText] = useState('');
  const [editTargetText, setEditTargetText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const latestRecord = useMemo(
    () => history.find((h) => h.id === latestRecordId) ?? null,
    [history, latestRecordId]
  );

  const detailRecord = useMemo(
    () => history.find((h) => h.id === detailRecordId) ?? null,
    [history, detailRecordId]
  );

  const isTargetLocale = selectedLocale !== sourceLocale;
  const canSelectTarget = targetLocales.length > 0;

  const localeLabel = (l: string) => {
    if (l === sourceLocale) return `${l}（源语言）`;
    return l;
  };

  const openDetails = (id: string) => {
    setDetailRecordId(id);
    setDetailOpen(true);
  };

  const resetCreateForm = () => {
    setCreateKeyMode('auto');
    setCreateAutoKey(`ctx_${randomId().slice(0, 8)}`);
    setCreateKey('');
    setCreateSourceText('');
    setCreateTargetLocale(targetLocales[0] ?? sourceLocale);
    setCreateTargetText('');
    setCreateError(null);
  };

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.values(entries);
    if (!q) return list.sort((a, b) => a.key.localeCompare(b.key));

    return list
      .filter((e) => {
        if (e.key.toLowerCase().includes(q)) return true;
        if (e.sourceText.toLowerCase().includes(q)) return true;
        if (selectedLocale !== sourceLocale) {
          const tr = e.translations[selectedLocale];
          if (tr?.text?.toLowerCase().includes(q)) return true;
        }
        return false;
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [entries, query, selectedLocale, sourceLocale]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const pagedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedLocale]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const openEdit = (key: string) => {
    const entry = entries[key];
    if (!entry) return;

    setEditKey(key);
    setEditSourceText(entry.sourceText);
    setEditTargetText(
      selectedLocale === sourceLocale
        ? ''
        : entry.translations[selectedLocale]?.text ?? ''
    );
    setEditError(null);
    setEditOpen(true);
  };

  const entryColumns = useMemo<Array<TableColumn<Entry>>>(
    () => [
      {
        key: 'key',
        title: 'Key',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: Entry) => (
          <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
            {record.key}
          </code>
        )
      },
      {
        key: 'sourceText',
        title: '源文案',
        dataIndex: 'sourceText',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (value: unknown) => (
          <div className="max-w-[420px] break-words">{String(value ?? '')}</div>
        )
      },
      {
        key: 'currentLocale',
        title: '当前语言',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: Entry) => {
          const tr = selectedLocale === sourceLocale ? null : record.translations[selectedLocale];
          const currentText =
            selectedLocale === sourceLocale
              ? record.sourceText
              : tr?.text?.trim()
                ? tr.text
                : '';

          return currentText ? (
            <div className="max-w-[420px] break-words">{currentText}</div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        }
      },
      {
        key: 'status',
        title: '状态',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: Entry) => {
          const tr = selectedLocale === sourceLocale ? null : record.translations[selectedLocale];
          if (selectedLocale === sourceLocale) {
            return <span className="text-xs text-muted-foreground">源语言</span>;
          }
          return tr ? <StatusPill status={tr.status} /> : <StatusPill status="pending" />;
        }
      },
      {
        key: 'updatedAt',
        title: '更新时间',
        dataIndex: 'updatedAt',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-muted-foreground',
        render: (value: unknown) => (
          <span suppressHydrationWarning>{formatDateTime(Number(value))}</span>
        )
      },
      {
        key: 'actions',
        title: '操作',
        headerClassName: 'bg-card px-3 py-2 text-right font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-right',
        align: 'right',
        render: (_value: unknown, record: Entry) => (
          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(record.key)}>
            <Pencil />
            编辑
          </Button>
        )
      }
    ],
    [openEdit, selectedLocale, sourceLocale]
  );

  const historyColumns = useMemo<Array<TableColumn<UploadRecord>>>(
    () => [
      {
        key: 'createdAt',
        title: '时间',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: UploadRecord) => (
          <span suppressHydrationWarning>{formatDateTime(record.createdAt)}</span>
        )
      },
      {
        key: 'locale',
        title: '语言',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: UploadRecord) => (
          <div className="flex items-center gap-2">
            <span className="text-foreground">{record.locale}</span>
            {record.locale === sourceLocale ? (
              <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                源
              </span>
            ) : null}
          </div>
        )
      },
      {
        key: 'operator',
        title: '操作者',
        dataIndex: 'operator',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground'
      },
      {
        key: 'summary',
        title: '摘要',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: UploadRecord) => (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground">
              新增 {record.summary.added}
            </span>
            <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground">
              更新 {record.summary.updated}
            </span>
            {record.locale === sourceLocale ? (
              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground">
                有更新 {record.summary.hasUpdate}
              </span>
            ) : (
              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground">
                待审核 {record.summary.pendingReview}
              </span>
            )}
          </div>
        )
      },
      {
        key: 'actions',
        title: '操作',
        headerClassName: 'bg-card px-3 py-2 text-right font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-right',
        align: 'right',
        render: (_value: unknown, record: UploadRecord) => (
          <Button type="button" variant="outline" size="sm" onClick={() => openDetails(record.id)}>
            查看
          </Button>
        )
      }
    ],
    [openDetails, sourceLocale]
  );

  const updatedKeyColumns = useMemo<Array<TableColumn<UpdatedKeyRow>>>(
    () => [
      {
        key: 'key',
        title: 'Key',
        headerClassName: 'bg-background px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: UpdatedKeyRow) => (
          <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
            {record.key}
          </code>
        )
      },
      {
        key: 'before',
        title: '之前',
        dataIndex: 'before',
        headerClassName: 'bg-background px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (value: unknown) => String(value || '—')
      },
      {
        key: 'after',
        title: '之后',
        dataIndex: 'after',
        headerClassName: 'bg-background px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (value: unknown) => String(value || '—')
      }
    ],
    []
  );

  const handleSaveEdit = () => {
    if (!editKey) return;

    const sourceText = editSourceText.trim();
    if (!sourceText) {
      setEditError('请填写源文案。');
      return;
    }

    const now = Date.now();
    const nextTargetText = editTargetText.trim();

    setEntries((prev) => {
      const existing = prev[editKey];
      if (!existing) return prev;

      const sourceChanged = existing.sourceText !== sourceText;
      let nextTranslations: Entry['translations'] = existing.translations;

      if (sourceChanged) {
        const updatedTranslations: Entry['translations'] = { ...nextTranslations };
        for (const tLocale of targetLocales) {
          const tr = updatedTranslations[tLocale];
          if (!tr) continue;
          if (tr.text.trim().length > 0) {
            updatedTranslations[tLocale] = {
              ...tr,
              status: 'needs_update',
              updatedAt: now
            };
          }
        }
        nextTranslations = updatedTranslations;
      }

      if (selectedLocale !== sourceLocale) {
        const current = nextTranslations[selectedLocale] ?? {
          text: '',
          status: 'pending' as const,
          updatedAt: existing.updatedAt
        };

        const nextTr: EntryTranslation = {
          text: nextTargetText,
          status: nextTargetText ? 'needs_review' : 'pending',
          updatedAt: now
        };

        nextTranslations = {
          ...nextTranslations,
          [selectedLocale]: current.text === nextTr.text && current.status === nextTr.status ? current : nextTr
        };
      }

      const nextEntry: Entry = {
        ...existing,
        sourceText,
        updatedAt: now,
        translations: nextTranslations
      };

      return { ...prev, [editKey]: nextEntry };
    });

    push({ variant: 'default', title: '已保存', message: editKey });
    setEditOpen(false);
  };

  const applySourceUpload = (incoming: Record<string, string>) => {
    const now = Date.now();
    const existingKeys = Object.keys(entries);
    const incomingKeys = Object.keys(incoming);

    const addedKeys: string[] = [];
    const updatedKeys: Array<{ key: string; before: string; after: string }> = [];
    const hasUpdateKeys: string[] = [];

    const nextEntries: Record<string, Entry> = { ...entries };

    for (const key of incomingKeys) {
      const nextText = incoming[key];
      const existing = nextEntries[key];

      if (!existing) {
        const translations: Entry['translations'] = {};
        for (const tLocale of targetLocales) {
          translations[tLocale] = {
            text: '',
            status: 'pending',
            updatedAt: now
          };
        }
        nextEntries[key] = {
          key,
          sourceText: nextText,
          createdAt: now,
          updatedAt: now,
          translations
        };
        addedKeys.push(key);
        continue;
      }

      if (existing.sourceText !== nextText) {
        updatedKeys.push({ key, before: existing.sourceText, after: nextText });
        const updatedTranslations: Entry['translations'] = { ...existing.translations };

        let changedAny = false;
        for (const tLocale of targetLocales) {
          const tr = updatedTranslations[tLocale];
          if (!tr) continue;
          if (tr.text.trim().length > 0 && tr.status !== 'needs_update') {
            updatedTranslations[tLocale] = { ...tr, status: 'needs_update', updatedAt: now };
            changedAny = true;
          }
        }
        if (changedAny) hasUpdateKeys.push(key);

        nextEntries[key] = {
          ...existing,
          sourceText: nextText,
          updatedAt: now,
          translations: updatedTranslations
        };
      }
    }

    const missingInUpload = existingKeys.filter((k) => !incomingKeys.includes(k)).length;

    const summary: UploadSummary = {
      added: addedKeys.length,
      updated: updatedKeys.length,
      missingInUpload,
      hasUpdate: hasUpdateKeys.length,
      pendingReview: 0,
      ignored: 0
    };

    const record: UploadRecord = {
      id: randomId(),
      createdAt: now,
      locale: sourceLocale,
      operator: 'Victor',
      summary,
      addedKeys,
      updatedKeys,
      pendingReviewKeys: [],
      hasUpdateKeys,
      ignoredKeys: []
    };

    setEntries(nextEntries);
    setHistory((prev) => [record, ...prev]);
    setLatestRecordId(record.id);

    return { record };
  };

  const applyTargetUpload = (incoming: Record<string, string>, targetLocale: string) => {
    const now = Date.now();
    const addedKeys: string[] = [];
    const updatedKeys: Array<{ key: string; before: string; after: string }> = [];
    const pendingReviewKeys: string[] = [];
    const ignoredKeys: string[] = [];

    const nextEntries: Record<string, Entry> = { ...entries };
    for (const [key, nextText] of Object.entries(incoming)) {
      const existing = nextEntries[key];
      if (!existing) {
        ignoredKeys.push(key);
        continue;
      }

      const currentTr = existing.translations[targetLocale] ?? {
        text: '',
        status: 'pending' as const,
        updatedAt: existing.updatedAt
      };
      const before = currentTr.text;
      if (before !== nextText) {
        updatedKeys.push({ key, before, after: nextText });
      }

      const nextTr: EntryTranslation = {
        text: nextText,
        status: 'needs_review',
        updatedAt: now
      };

      pendingReviewKeys.push(key);
      nextEntries[key] = {
        ...existing,
        updatedAt: now,
        translations: { ...existing.translations, [targetLocale]: nextTr }
      };
    }

    const summary: UploadSummary = {
      added: addedKeys.length,
      updated: updatedKeys.length,
      missingInUpload: 0,
      hasUpdate: 0,
      pendingReview: pendingReviewKeys.length,
      ignored: ignoredKeys.length
    };

    const record: UploadRecord = {
      id: randomId(),
      createdAt: now,
      locale: targetLocale,
      operator: 'Victor',
      summary,
      addedKeys,
      updatedKeys,
      pendingReviewKeys,
      hasUpdateKeys: [],
      ignoredKeys
    };

    setEntries(nextEntries);
    setHistory((prev) => [record, ...prev]);
    setLatestRecordId(record.id);
    return { record };
  };

  const handlePickFile = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setUploadBusy(true);
    setUploadError(null);

    let raw = '';
    try {
      raw = await file.text();
    } catch {
      setUploadError('读取文件失败：请重试或更换文件。');
      setUploadBusy(false);
      return;
    }

    try {
      if (!canManage) {
        push({ variant: 'destructive', title: '无权限', message: '仅项目管理员/创建者可导入语言包。' });
        return;
      }

      const res = await importLanguagePackAction({
        projectId,
        locale: selectedLocale,
        rawJson: raw
      });
      if (!res.ok) {
        setUploadError(res.error);
        push({ variant: 'destructive', title: '上传失败', message: res.error });
        return;
      }

      const now = Date.now();
      const nextSummary: UploadSummary =
        res.data.kind === 'source'
          ? {
              added: res.data.summary.added,
              updated: res.data.summary.updated,
              missingInUpload: 0,
              hasUpdate: res.data.summary.markedNeedsUpdate,
              pendingReview: 0,
              ignored: 0
            }
          : {
              added: 0,
              updated: (res.data.summary as { updated: number }).updated,
              missingInUpload: 0,
              hasUpdate: 0,
              pendingReview: (res.data.summary as { updated: number }).updated,
              ignored: (res.data.summary as { ignored: number }).ignored
            };

      const record: UploadRecord = {
        id: randomId(),
        createdAt: now,
        locale: selectedLocale,
        operator: '—',
        summary: nextSummary,
        addedKeys: [],
        updatedKeys: [],
        pendingReviewKeys: [],
        hasUpdateKeys: [],
        ignoredKeys: []
      };
      setHistory((prev) => [record, ...prev]);
      setLatestRecordId(record.id);

      const suffix =
        res.data.kind === 'source'
          ? `新增 ${nextSummary.added}，更新 ${nextSummary.updated}，标记需更新 ${nextSummary.hasUpdate}`
          : `写入 ${nextSummary.pendingReview}（待审核），忽略 ${nextSummary.ignored}，跳过空值 ${(res.data.summary as { skippedEmpty: number }).skippedEmpty}`;

      push({ variant: 'default', title: '上传成功', message: suffix });

      const listRes = await listPackagesEntriesQuery(projectId);
      if (listRes.ok) {
        setEntries(mapEntriesFromServer(listRes.data.items, targetLocales));
      }
    } catch {
      push({ variant: 'destructive', title: '上传失败', message: '处理文件时发生异常，请重试。' });
    } finally {
      setUploadBusy(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await exportLanguagePackAction({
        projectId,
        locale: downloadLocale,
        mode: downloadMode
      });
      if (!res.ok) {
        push({ variant: 'destructive', title: '导出失败', message: res.error });
        return;
      }

      const blob = new Blob([res.data.content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push({ variant: 'default', title: '已开始下载', message: `导出语言：${downloadLocale}` });
    } catch {
      push({ variant: 'destructive', title: '导出失败', message: '导出过程中发生异常，请重试。' });
    }
  };

  const currentLocaleStats = useMemo(() => {
    const total = Object.keys(entries).length;
    if (selectedLocale === sourceLocale) {
      return { total, filled: total, pending: 0, hasUpdate: 0, approved: 0, untranslated: 0 };
    }

    let filled = 0;
    let pending = 0;
    let hasUpdate = 0;
    let approved = 0;
    let untranslated = 0;
    for (const e of Object.values(entries)) {
      const tr = e.translations[selectedLocale];
      if (!tr) {
        untranslated += 1;
        continue;
      }
      if (tr.text.trim().length > 0) filled += 1;
      if (tr.status === 'needs_review' || tr.status === 'ready') pending += 1;
      else if (tr.status === 'needs_update') hasUpdate += 1;
      else if (tr.status === 'approved') approved += 1;
      else untranslated += 1;
    }
    return { total, filled, pending, hasUpdate, approved, untranslated };
  }, [entries, selectedLocale, sourceLocale]);

  const handleCreate = () => {
    setCreateError(null);
    const now = Date.now();
    const nextKey = createKeyMode === 'auto' ? createAutoKey.trim() : createKey.trim();
    const sourceText = createSourceText.trim();
    const targetText = createTargetText.trim();

    if (!nextKey) {
      setCreateError('请填写 key。');
      return;
    }
    if (!sourceText) {
      setCreateError('请填写源文案。');
      return;
    }
    if (entries[nextKey]) {
      setCreateError('key 已存在：请修改 key 或重新生成。');
      return;
    }

    const translations: Entry['translations'] = {};
    for (const l of targetLocales) {
      translations[l] = {
        text: l === createTargetLocale ? targetText : '',
        status: l === createTargetLocale && targetText ? 'needs_review' : 'pending',
        updatedAt: now
      };
    }

    const entry: Entry = {
      key: nextKey,
      sourceText,
      createdAt: now,
      updatedAt: now,
      translations
    };

    setEntries((prev) => ({ ...prev, [entry.key]: entry }));
    push({ variant: 'default', title: '已新增词条', message: entry.key });

    setCreateOpen(false);
    resetCreateForm();
  };

  if (!canSelectTarget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">请先添加目标语言</CardTitle>
          <CardDescription>目标语言用于后续翻译与导出；可在项目设置中配置。</CardDescription>
          <CardAction>
            <Button asChild>
              <Link href={`/projects/${projectId}/settings/locales`}>前往项目设置</Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">语言选择</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {allLocales.map((l) => {
              const active = selectedLocale === l;
              return (
                <Button
                  key={l}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setUploadError(null);
                    setSelectedLocale(l);
                  }}
                >
                  {l}
                  {l === sourceLocale ? (
                    <span className="ml-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                      源
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
              词条总数 {currentLocaleStats.total}
            </span>
            <span className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
              已填写 {currentLocaleStats.filled}
            </span>
            <span className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
              待审核 {currentLocaleStats.pending}
            </span>
            <span className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
              有更新 {currentLocaleStats.hasUpdate}
            </span>
          </div>
        </CardContent>
      </Card>

      {variant === 'entries' ? (
        <>
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-base">词条池</CardTitle>
                {/* <CardDescription>平台内所有词条展示与维护</CardDescription> */}
              </div>
              <CardAction className="flex items-center gap-2">
                <Button asChild variant="outline">
                  <Link href={`/projects/${projectId}/overview`}>打开项目概览</Link>
                </Button>
                <Dialog
                  open={createOpen}
                  onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (open) {
                      setCreateTargetLocale(
                        selectedLocale === sourceLocale
                          ? (targetLocales[0] ?? sourceLocale)
                          : selectedLocale
                      );
                      return;
                    }
                    resetCreateForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button type="button">
                      <Plus />
                      新增词条
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-lg">新增词条</DialogTitle>
                      <DialogDescription>源文案必填；目标文案可选（将进入待审核）。</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                      <div className="grid gap-3 rounded-lg border bg-card p-4">
                        <div className="text-sm font-semibold text-foreground">Key 生成</div>
                        <RadioGroup
                          value={createKeyMode}
                          onValueChange={(v) => setCreateKeyMode(v as 'auto' | 'manual')}
                          className="grid gap-2"
                          optionClassName="items-start gap-2"
                          options={[
                            {
                              value: 'auto',
                              label: (
                                <div>
                                  <div className="text-sm text-foreground">系统生成（默认）</div>
                                  <div className="text-sm text-muted-foreground">
                                    ctx_ + 8 位短 ID（项目内唯一）
                                  </div>
                                </div>
                              )
                            },
                            {
                              value: 'manual',
                              label: (
                                <div>
                                  <div className="text-sm text-foreground">手动输入（推荐）</div>
                                  <div className="text-sm text-muted-foreground">
                                    适合工程化命名与长期维护
                                  </div>
                                </div>
                              )
                            }
                          ]}
                        />

                        {createKeyMode === 'auto' ? (
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                            <div>
                              <Label htmlFor="auto-key">Key</Label>
                              <Input
                                id="auto-key"
                                value={createAutoKey}
                                onChange={(e) => setCreateAutoKey(e.target.value)}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCreateAutoKey(`ctx_${randomId().slice(0, 8)}`)}
                            >
                              <RefreshCcw />
                              重新生成
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <Label htmlFor="manual-key">Key</Label>
                            <Input
                              id="manual-key"
                              placeholder="例如：page.login.title"
                              value={createKey}
                              onChange={(e) => setCreateKey(e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3 rounded-lg border bg-card p-4">
                        <div className="text-sm font-semibold text-foreground">内容</div>
                        <div>
                          <Label htmlFor="source-text">源文案</Label>
                          <Input
                            id="source-text"
                            placeholder="必填"
                            value={createSourceText}
                            onChange={(e) => setCreateSourceText(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="target-locale">目标语言（可选）</Label>
                            <TargetLocaleSelect
                              id="target-locale"
                              targetLocales={targetLocales}
                              value={createTargetLocale}
                              onValueChange={setCreateTargetLocale}
                              className="mt-1 w-full"
                              placeholder="选择目标语言（可选）"
                            />
                          </div>
                          <div>
                            <Label htmlFor="target-text">目标文案</Label>
                            <Input
                              id="target-text"
                              placeholder="可选"
                              value={createTargetText}
                              onChange={(e) => setCreateTargetText(e.target.value)}
                            />
                          </div>
                        </div>
                        {createTargetText.trim() ? (
                          <div className="text-sm text-muted-foreground">
                            保存后该译文将进入 <span className="text-foreground">待审核</span>。
                          </div>
                        ) : null}
                        {createError ? (
                          <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
                            {createError}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCreateOpen(false);
                          resetCreateForm();
                        }}
                      >
                        取消
                      </Button>
                      <Button type="button" onClick={handleCreate}>
                        保存
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-md">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索 key / 源文案 / 当前语言"
                  />
                </div>
                <div className="text-sm text-muted-foreground">共 {filteredEntries.length} 条</div>
              </div>

              {filteredEntries.length === 0 ? (
                <div className="rounded-lg border bg-background p-6">
                  <div className="text-sm font-semibold text-foreground">暂无匹配词条</div>
                  <div className="mt-1 text-sm text-muted-foreground">可尝试清空搜索或新增词条。</div>
                </div>
              ) : (
                <Table
                  columns={entryColumns}
                  data={pagedEntries}
                  rowKey="key"
                  className="rounded-md border"
                  tableClassName="text-sm"
                />
              )}

              {filteredEntries.length > 0 ? (
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  total={filteredEntries.length}
                  onChange={(next) => setPage(next)}
                />
              ) : null}
            </CardContent>
          </Card>

          <Dialog
            open={editOpen}
            onOpenChange={(open) => {
              setEditOpen(open);
              if (!open) {
                setEditKey(null);
                setEditSourceText('');
                setEditTargetText('');
                setEditError(null);
              }
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg">编辑词条</DialogTitle>
                <DialogDescription>
                  {editKey ? `Key：${editKey}` : '—'}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="edit-source">源文案</Label>
                  <Input
                    id="edit-source"
                    value={editSourceText}
                    onChange={(e) => setEditSourceText(e.target.value)}
                  />
                </div>
                {selectedLocale !== sourceLocale ? (
                  <div>
                    <Label htmlFor="edit-target">当前语言（{selectedLocale}）</Label>
                    <Input
                      id="edit-target"
                      value={editTargetText}
                      onChange={(e) => setEditTargetText(e.target.value)}
                      placeholder="留空表示未翻译"
                    />
                    <div className="mt-2 text-sm text-muted-foreground">
                      修改目标文案会进入 <span className="text-foreground">待审核</span>；修改源文案会将已有译文标记为 <span className="text-foreground">有更新</span>。
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    当前选择为源语言；修改源文案会将已有译文标记为 <span className="text-foreground">有更新</span>。
                  </div>
                )}

                {editError ? (
                  <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
                    {editError}
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  取消
                </Button>
                <Button type="button" onClick={handleSaveEdit} disabled={!editKey}>
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="grid gap-4 grid-cols-1">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">上传语言包（{localeLabel(selectedLocale)}）</CardTitle>
                <CardDescription>一份 JSON 对应一种语言。</CardDescription>
                <CardAction className="flex items-center gap-2">
                  <Dialog
                    open={exportOpen}
                    onOpenChange={(open) => {
                      setExportOpen(open);
                      if (open) {
                        setDownloadLocale(selectedLocale);
                        setDownloadMode('fallback');
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" disabled={uploadBusy}>
                        <Download />
                        导出…
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-lg">导出语言包</DialogTitle>
                        <DialogDescription>选择语言与导出选项，生成 JSON 文件下载。</DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="download-locale">导出语言</Label>
                          <select
                            id="download-locale"
                            className={cn(selectClassName())}
                            value={downloadLocale}
                            onChange={(e) => setDownloadLocale(e.target.value)}
                          >
                            {allLocales.map((l) => (
                              <option key={l} value={l}>
                                {localeLabel(l)}
                              </option>
                            ))}
                          </select>
                          <div className="text-sm text-muted-foreground">
                            文件名：project-{projectId}.{downloadLocale}.json
                          </div>
                          <div className="text-sm text-muted-foreground">
                            结构：{templateShape === 'tree' ? '树形' : '扁平'}
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label>导出选项（MVP）</Label>
                          <div className="rounded-md border bg-background p-3">
                            <RadioGroup
                              value={downloadMode}
                              onValueChange={(v) => setDownloadMode(v as DownloadMode)}
                              className="grid gap-2"
                              optionClassName="items-start gap-2"
                              options={[
                                {
                                  value: 'fallback',
                                  label: (
                                    <div>
                                      <div className="text-sm text-foreground">
                                        未翻译回退源语言（默认）
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        便于联调与避免空文本
                                      </div>
                                    </div>
                                  )
                                },
                                {
                                  value: 'empty',
                                  label: (
                                    <div>
                                      <div className="text-sm text-foreground">未翻译导出空字符串</div>
                                      <div className="text-sm text-muted-foreground">
                                        便于定位缺失翻译
                                      </div>
                                    </div>
                                  )
                                },
                                {
                                  value: 'filled',
                                  label: (
                                    <div>
                                      <div className="text-sm text-foreground">仅导出已填写</div>
                                      <div className="text-sm text-muted-foreground">
                                        仅包含有目标文案的 key
                                      </div>
                                    </div>
                                  )
                                }
                              ]}
                            />
                          </div>
                        </div>

                        {downloadLocale !== sourceLocale ? (
                          <div className="rounded-lg border bg-card p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm text-muted-foreground">
                                目标语言上传写入后将进入 <span className="text-foreground">待审核</span>；源语言更新会导致译文变为 <span className="text-foreground">有更新</span>。
                              </div>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/projects/${projectId}/workbench?locale=${encodeURIComponent(downloadLocale)}`}>前往翻译工作台</Link>
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setExportOpen(false)}>
                          取消
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            handleDownload();
                            setExportOpen(false);
                          }}
                        >
                          <Download />
                          开始导出
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button type="button" onClick={handlePickFile} disabled={uploadBusy}>
                    {uploadBusy ? <Loader2 className="animate-spin" /> : <Upload />}
                    选择 JSON 文件
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = '';
                    void handleFileChange(file);
                  }}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-card p-4">
                    <SectionTitle title="结构约束" desc="仅支持扁平 JSON，不支持嵌套对象。" />
                    <pre className="mt-3 overflow-auto rounded-md border bg-background p-3 text-xs text-foreground">{
`{
  "common.save": "保存",
  "auth.signIn": "登录"
}`
                    }</pre>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <SectionTitle title="命名建议" desc="推荐使用点分隔、稳定语义、避免大小写混用。" />
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground">✅ 推荐</span>
                        <code className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">page.login.title</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground">✅ 推荐</span>
                        <code className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">common.save</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground">⚠️ 避免</span>
                        <code className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">SaveButtonText</code>
                      </div>
                    </div>
                  </div>
                </div>

                {uploadError ? (
                  <div className="rounded-lg border border-destructive/30 bg-card p-4">
                    <div className="text-sm font-semibold text-destructive">上传失败</div>
                    <div className="mt-1 text-sm text-muted-foreground">{uploadError}</div>
                  </div>
                ) : null}

                {latestRecord ? (
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">上传结果摘要</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span suppressHydrationWarning>{formatDateTime(latestRecord.createdAt)}</span> · {latestRecord.operator}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openDetails(latestRecord.id)}
                        >
                          <Eye />
                          查看详情
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-md border bg-background px-3 py-2">
                        <div className="text-xs text-muted-foreground">新增 key 数</div>
                        <div className="mt-0.5 text-base font-semibold text-foreground">
                          {latestRecord.summary.added}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background px-3 py-2">
                        <div className="text-xs text-muted-foreground">更新 key 数</div>
                        <div className="mt-0.5 text-base font-semibold text-foreground">
                          {latestRecord.summary.updated}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background px-3 py-2">
                        <div className="text-xs text-muted-foreground">删除 key 数</div>
                        <div className="mt-0.5 text-base font-semibold text-foreground">
                          {latestRecord.summary.missingInUpload}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">不自动删除</span>
                        </div>
                      </div>
                      {latestRecord.locale === sourceLocale ? (
                        <>
                          <div className="rounded-md border bg-background px-3 py-2">
                            <div className="text-xs text-muted-foreground">有更新 key 数</div>
                            <div className="mt-0.5 text-base font-semibold text-foreground">
                              {latestRecord.summary.hasUpdate}
                            </div>
                          </div>
                          <div className="rounded-md border bg-background px-3 py-2">
                            <div className="text-xs text-muted-foreground">待审核词条数</div>
                            <div className="mt-0.5 text-base font-semibold text-foreground">0</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rounded-md border bg-background px-3 py-2">
                            <div className="text-xs text-muted-foreground">待审核词条数</div>
                            <div className="mt-0.5 text-base font-semibold text-foreground">
                              {latestRecord.summary.pendingReview}
                            </div>
                          </div>
                          <div className="rounded-md border bg-background px-3 py-2">
                            <div className="text-xs text-muted-foreground">被忽略 key 数</div>
                            <div className="mt-0.5 text-base font-semibold text-foreground">
                              {latestRecord.summary.ignored}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card id="upload-history">
            <CardHeader>
              <CardTitle className="text-base">上传历史</CardTitle>
              <CardDescription>时间、语言、操作者与摘要；点击可查看详情。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <div className="rounded-lg border bg-background p-6">
                  <div className="text-sm font-semibold text-foreground">暂无上传记录</div>
                  <div className="mt-1 text-sm text-muted-foreground">上传一次语言包后，会在这里生成可回溯记录。</div>
                </div>
              ) : (
                <Table
                  columns={historyColumns}
                  data={history}
                  rowKey="id"
                  className="max-h-[520px] overflow-auto rounded-md border"
                  tableClassName="text-sm"
                />
              )}

              <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-lg">上传记录详情</DialogTitle>
                    <DialogDescription>
                      {detailRecord
                        ? `${formatDateTime(detailRecord.createdAt)} · ${detailRecord.locale} · ${detailRecord.operator}`
                        : '—'}
                    </DialogDescription>
                  </DialogHeader>

                  {detailRecord ? (
                    <div className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg border bg-background px-3 py-2">
                          <div className="text-xs text-muted-foreground">新增 key</div>
                          <div className="mt-0.5 text-base font-semibold text-foreground">{detailRecord.summary.added}</div>
                        </div>
                        <div className="rounded-lg border bg-background px-3 py-2">
                          <div className="text-xs text-muted-foreground">更新 key</div>
                          <div className="mt-0.5 text-base font-semibold text-foreground">{detailRecord.summary.updated}</div>
                        </div>
                        {detailRecord.locale === sourceLocale ? (
                          <div className="rounded-lg border bg-background px-3 py-2">
                            <div className="text-xs text-muted-foreground">有更新</div>
                            <div className="mt-0.5 text-base font-semibold text-foreground">{detailRecord.summary.hasUpdate}</div>
                          </div>
                        ) : (
                          <div className="rounded-lg border bg-background px-3 py-2">
                            <div className="text-xs text-muted-foreground">待审核</div>
                            <div className="mt-0.5 text-base font-semibold text-foreground">{detailRecord.summary.pendingReview}</div>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-foreground">新增词条</div>
                            <span className="text-xs text-muted-foreground">{detailRecord.addedKeys.length} 条</span>
                          </div>
                          {detailRecord.addedKeys.length === 0 ? (
                            <div className="mt-2 text-sm text-muted-foreground">本次无新增。</div>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {detailRecord.addedKeys.slice(0, 30).map((k) => (
                                <code key={k} className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
                                  {k}
                                </code>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-foreground">更新差异</div>
                            <span className="text-xs text-muted-foreground">{detailRecord.updatedKeys.length} 条</span>
                          </div>
                          {detailRecord.updatedKeys.length === 0 ? (
                            <div className="mt-2 text-sm text-muted-foreground">本次无更新。</div>
                          ) : (
                            <Table
                              columns={updatedKeyColumns}
                              data={detailRecord.updatedKeys.slice(0, 20)}
                              rowKey="key"
                              className="mt-3 rounded-md border"
                              tableClassName="text-sm"
                            />
                          )}
                        </div>
                      </div>

                      {detailRecord.locale !== sourceLocale ? (
                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-foreground">待审核列表</div>
                              <div className="mt-1 text-sm text-muted-foreground">目标语言上传导入/覆盖的译文会统一进入待审核。</div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/projects/${projectId}/workbench?locale=${encodeURIComponent(detailRecord.locale)}&status=needs_review`}>
                                跳转到翻译工作台
                              </Link>
                            </Button>
                          </div>
                          {detailRecord.pendingReviewKeys.length === 0 ? (
                            <div className="mt-3 text-sm text-muted-foreground">本次无待审核。</div>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {detailRecord.pendingReviewKeys.slice(0, 30).map((k) => (
                                <code key={k} className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
                                  {k}
                                </code>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-foreground">有更新列表</div>
                              <div className="mt-1 text-sm text-muted-foreground">源文案更新会使已存在译文标记为有更新。</div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/projects/${projectId}/workbench?status=needs_update`}>
                                跳转到翻译工作台
                              </Link>
                            </Button>
                          </div>
                          {detailRecord.hasUpdateKeys.length === 0 ? (
                            <div className="mt-3 text-sm text-muted-foreground">本次无有更新。</div>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {detailRecord.hasUpdateKeys.slice(0, 30).map((k) => (
                                <code key={k} className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
                                  {k}
                                </code>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {detailRecord.ignoredKeys.length > 0 ? (
                        <div className="rounded-lg border border-warning/40 bg-card p-4">
                          <div className="text-sm font-semibold text-foreground">被忽略的 key</div>
                          <div className="mt-1 text-sm text-muted-foreground">目标语言上传不允许新增 key；源语言不存在的 key 会被忽略。</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {detailRecord.ignoredKeys.slice(0, 30).map((k) => (
                              <code key={k} className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
                                {k}
                              </code>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">未找到该记录。</div>
                  )}

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
                      关闭
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
