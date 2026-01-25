'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Download, Plus, RefreshCcw, Eye, Pencil } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type TranslationStatus = 'untranslated' | 'pending_review' | 'approved' | 'has_update';

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
  const now = Date.now();
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
        'ja-JP': { text: 'ログイン', status: 'pending_review' }
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
        'ja-JP': { text: '', status: 'untranslated' }
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
        : { text: '', status: 'untranslated', updatedAt: now - 1000 * 60 * 60 * 24 };
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
      : status === 'pending_review'
        ? { label: '待审核', cls: 'border-warning/40 text-warning' }
        : status === 'has_update'
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
  variant = 'entries'
}: {
  projectId: number;
  variant?: 'entries' | 'ops';
}) {
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mockProject = useMemo(
    () => ({
      sourceLocale: 'zh-CN',
      targetLocales: ['en-US', 'ja-JP']
    }),
    []
  );

  const allLocales = useMemo(
    () => [mockProject.sourceLocale, ...mockProject.targetLocales],
    [mockProject.sourceLocale, mockProject.targetLocales]
  );

  const [selectedLocale, setSelectedLocale] = useState(mockProject.sourceLocale);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadLocale, setDownloadLocale] = useState(mockProject.sourceLocale);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('fallback');
  const [exportOpen, setExportOpen] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    buildMockEntries(mockProject.sourceLocale, mockProject.targetLocales).entriesByKey
  );
  const [history, setHistory] = useState<UploadRecord[]>(() => {
    const now = Date.now();
    const rec: UploadRecord = {
      id: randomId(),
      createdAt: now - 1000 * 60 * 60 * 5,
      locale: 'zh-CN',
      operator: 'Victor',
      summary: {
        added: 3,
        updated: 1,
        missingInUpload: 0,
        hasUpdate: 1,
        pendingReview: 0,
        ignored: 0
      },
      addedKeys: ['billing.invoiceTitle', 'billing.payNow', 'settings.language'],
      updatedKeys: [{ key: 'auth.signIn', before: '登录', after: '登录/注册' }],
      pendingReviewKeys: [],
      hasUpdateKeys: ['auth.signIn'],
      ignoredKeys: []
    };
    return [rec];
  });
  const [latestRecordId, setLatestRecordId] = useState<string | null>(() => history[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createKeyMode, setCreateKeyMode] = useState<'auto' | 'manual'>('auto');
  const [createAutoKey, setCreateAutoKey] = useState(() => `ctx_${randomId().slice(0, 8)}`);
  const [createKey, setCreateKey] = useState('');
  const [createSourceText, setCreateSourceText] = useState('');
  const [createTargetLocale, setCreateTargetLocale] = useState(mockProject.targetLocales[0] ?? mockProject.sourceLocale);
  const [createTargetText, setCreateTargetText] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
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

  const isTargetLocale = selectedLocale !== mockProject.sourceLocale;
  const canSelectTarget = mockProject.targetLocales.length > 0;

  const localeLabel = (l: string) => {
    if (l === mockProject.sourceLocale) return `${l}（源语言）`;
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
    setCreateTargetLocale(mockProject.targetLocales[0] ?? mockProject.sourceLocale);
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
        if (selectedLocale !== mockProject.sourceLocale) {
          const tr = e.translations[selectedLocale];
          if (tr?.text?.toLowerCase().includes(q)) return true;
        }
        return false;
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [entries, mockProject.sourceLocale, query, selectedLocale]);

  const openEdit = (key: string) => {
    const entry = entries[key];
    if (!entry) return;

    setEditKey(key);
    setEditSourceText(entry.sourceText);
    setEditTargetText(
      selectedLocale === mockProject.sourceLocale
        ? ''
        : entry.translations[selectedLocale]?.text ?? ''
    );
    setEditError(null);
    setEditOpen(true);
  };

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
        for (const tLocale of mockProject.targetLocales) {
          const tr = updatedTranslations[tLocale];
          if (!tr) continue;
          if (tr.text.trim().length > 0) {
            updatedTranslations[tLocale] = {
              ...tr,
              status: 'has_update',
              updatedAt: now
            };
          }
        }
        nextTranslations = updatedTranslations;
      }

      if (selectedLocale !== mockProject.sourceLocale) {
        const current = nextTranslations[selectedLocale] ?? {
          text: '',
          status: 'untranslated' as const,
          updatedAt: existing.updatedAt
        };

        const nextTr: EntryTranslation = {
          text: nextTargetText,
          status: nextTargetText ? 'pending_review' : 'untranslated',
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
        for (const tLocale of mockProject.targetLocales) {
          translations[tLocale] = {
            text: '',
            status: 'untranslated',
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
        for (const tLocale of mockProject.targetLocales) {
          const tr = updatedTranslations[tLocale];
          if (!tr) continue;
          if (tr.text.trim().length > 0 && tr.status !== 'has_update') {
            updatedTranslations[tLocale] = { ...tr, status: 'has_update', updatedAt: now };
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
      locale: mockProject.sourceLocale,
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
        status: 'untranslated' as const,
        updatedAt: existing.updatedAt
      };
      const before = currentTr.text;
      if (before !== nextText) {
        updatedKeys.push({ key, before, after: nextText });
      }

      const nextTr: EntryTranslation = {
        text: nextText,
        status: 'pending_review',
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

    const parsed = parseFlatJsonMap(raw);
    if (!parsed.ok) {
      setUploadError(parsed.message);
      push({ variant: 'destructive', title: '上传失败', message: parsed.message });
      setUploadBusy(false);
      return;
    }

    window.setTimeout(() => {
      try {
        const result =
          selectedLocale === mockProject.sourceLocale
            ? applySourceUpload(parsed.value)
            : applyTargetUpload(parsed.value, selectedLocale);

        const summary = result.record.summary;
        const suffix =
          selectedLocale === mockProject.sourceLocale
            ? `新增 ${summary.added}，更新 ${summary.updated}，有更新 ${summary.hasUpdate}`
            : `写入 ${summary.pendingReview}（待审核），忽略 ${summary.ignored}`;

        push({ variant: 'default', title: '上传成功', message: suffix });
        if (selectedLocale !== mockProject.sourceLocale && summary.ignored > 0) {
          push({
            variant: 'destructive',
            title: '存在被忽略的 key',
            message: '目标语言上传不允许新增 key；源语言中不存在的 key 已被忽略。'
          });
        }
      } catch {
        push({ variant: 'destructive', title: '上传失败', message: '处理文件时发生异常，请重试。' });
      } finally {
        setUploadBusy(false);
      }
    }, 600);
  };

  const handleDownload = () => {
    const isSource = downloadLocale === mockProject.sourceLocale;
    const out: Record<string, string> = {};

    for (const e of Object.values(entries)) {
      if (isSource) {
        out[e.key] = e.sourceText;
        continue;
      }

      const tr = e.translations[downloadLocale];
      const hasText = !!tr?.text?.trim();
      if (downloadMode === 'filled' && !hasText) continue;
      if (hasText) out[e.key] = tr!.text;
      else out[e.key] = downloadMode === 'fallback' ? e.sourceText : '';
    }

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${projectId}.${downloadLocale}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push({ variant: 'default', title: '已开始下载', message: `导出语言：${downloadLocale}` });
  };

  const currentLocaleStats = useMemo(() => {
    const total = Object.keys(entries).length;
    if (selectedLocale === mockProject.sourceLocale) {
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
      if (tr.status === 'pending_review') pending += 1;
      else if (tr.status === 'has_update') hasUpdate += 1;
      else if (tr.status === 'approved') approved += 1;
      else untranslated += 1;
    }
    return { total, filled, pending, hasUpdate, approved, untranslated };
  }, [entries, mockProject.sourceLocale, selectedLocale]);

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
    for (const l of mockProject.targetLocales) {
      translations[l] = {
        text: l === createTargetLocale ? targetText : '',
        status: l === createTargetLocale && targetText ? 'pending_review' : 'untranslated',
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
          <CardDescription>源语言 key/文案来自上传；目标语言来自上传或平台内翻译。</CardDescription>
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
                  {l === mockProject.sourceLocale ? (
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
                <CardDescription>平台内所有词条展示与维护；导入导出与上传历史已迁移到项目概览。</CardDescription>
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
                        selectedLocale === mockProject.sourceLocale
                          ? (mockProject.targetLocales[0] ?? mockProject.sourceLocale)
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
                        >
                          <label className="flex items-start gap-2">
                            <RadioGroupItem value="auto" />
                            <div>
                              <div className="text-sm text-foreground">系统生成（默认）</div>
                              <div className="text-sm text-muted-foreground">ctx_ + 8 位短 ID（项目内唯一）</div>
                            </div>
                          </label>
                          <label className="flex items-start gap-2">
                            <RadioGroupItem value="manual" />
                            <div>
                              <div className="text-sm text-foreground">手动输入（推荐）</div>
                              <div className="text-sm text-muted-foreground">适合工程化命名与长期维护</div>
                            </div>
                          </label>
                        </RadioGroup>

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
                            <select
                              id="target-locale"
                              className={cn('mt-1', selectClassName())}
                              value={createTargetLocale}
                              onChange={(e) => setCreateTargetLocale(e.target.value)}
                            >
                              {mockProject.targetLocales.map((l) => (
                                <option key={l} value={l}>
                                  {l}
                                </option>
                              ))}
                            </select>
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
                <div className="overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-card">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Key</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">源文案</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">当前语言</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">状态</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">更新时间</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((e) => {
                        const tr = selectedLocale === mockProject.sourceLocale ? null : e.translations[selectedLocale];
                        const currentText =
                          selectedLocale === mockProject.sourceLocale
                            ? e.sourceText
                            : tr?.text?.trim()
                              ? tr.text
                              : '';

                        return (
                          <tr key={e.key} className="border-b last:border-b-0">
                            <td className="px-3 py-2 align-top">
                              <code className="rounded-md border bg-card px-2 py-1 text-xs text-foreground">{e.key}</code>
                            </td>
                            <td className="px-3 py-2 align-top text-foreground">
                              <div className="max-w-[420px] break-words">{e.sourceText}</div>
                            </td>
                            <td className="px-3 py-2 align-top text-foreground">
                              {currentText ? <div className="max-w-[420px] break-words">{currentText}</div> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {selectedLocale === mockProject.sourceLocale ? (
                                <span className="text-xs text-muted-foreground">源语言</span>
                              ) : tr ? (
                                <StatusPill status={tr.status} />
                              ) : (
                                <StatusPill status="untranslated" />
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-muted-foreground">{formatDateTime(e.updatedAt)}</td>
                            <td className="px-3 py-2 align-top text-right">
                              <Button type="button" variant="outline" size="sm" onClick={() => openEdit(e.key)}>
                                <Pencil />
                                编辑
                              </Button>
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
                {selectedLocale !== mockProject.sourceLocale ? (
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
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">上传语言包（{localeLabel(selectedLocale)}）</CardTitle>
                <CardDescription>仅支持扁平 key-value JSON；一份 JSON 对应一种语言。</CardDescription>
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
                        </div>

                        <div className="grid gap-2">
                          <Label>导出选项（MVP）</Label>
                          <div className="rounded-md border bg-background p-3">
                            <RadioGroup
                              value={downloadMode}
                              onValueChange={(v) => setDownloadMode(v as DownloadMode)}
                              className="grid gap-2"
                            >
                              <label className="flex items-start gap-2">
                                <RadioGroupItem value="fallback" />
                                <div>
                                  <div className="text-sm text-foreground">未翻译回退源语言（默认）</div>
                                  <div className="text-sm text-muted-foreground">便于联调与避免空文本</div>
                                </div>
                              </label>
                              <label className="flex items-start gap-2">
                                <RadioGroupItem value="empty" />
                                <div>
                                  <div className="text-sm text-foreground">未翻译导出空字符串</div>
                                  <div className="text-sm text-muted-foreground">便于定位缺失翻译</div>
                                </div>
                              </label>
                              <label className="flex items-start gap-2">
                                <RadioGroupItem value="filled" />
                                <div>
                                  <div className="text-sm text-foreground">仅导出已填写</div>
                                  <div className="text-sm text-muted-foreground">仅包含有目标文案的 key</div>
                                </div>
                              </label>
                            </RadioGroup>
                          </div>
                        </div>

                        {downloadLocale !== mockProject.sourceLocale ? (
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
                          {formatDateTime(latestRecord.createdAt)} · {latestRecord.operator}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link href="#upload-history">查看上传历史</Link>
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
                      {latestRecord.locale === mockProject.sourceLocale ? (
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
                <div className="max-h-[520px] overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-card">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">时间</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">语言</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">操作者</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">摘要</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2 align-top text-foreground">{formatDateTime(r.createdAt)}</td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex items-center gap-2">
                              <span className="text-foreground">{r.locale}</span>
                              {r.locale === mockProject.sourceLocale ? (
                                <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">源</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-foreground">{r.operator}</td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-foreground">新增 {r.summary.added}</span>
                              <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-foreground">更新 {r.summary.updated}</span>
                              {r.locale === mockProject.sourceLocale ? (
                                <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-foreground">有更新 {r.summary.hasUpdate}</span>
                              ) : (
                                <span className="rounded-md border bg-background px-2 py-0.5 text-xs text-foreground">待审核 {r.summary.pendingReview}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => openDetails(r.id)}>
                              查看
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                        {detailRecord.locale === mockProject.sourceLocale ? (
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
                            <div className="mt-3 overflow-auto rounded-md border">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-background">
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Key</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">之前</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">之后</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailRecord.updatedKeys.slice(0, 20).map((it) => (
                                    <tr key={it.key} className="border-b last:border-b-0">
                                      <td className="px-3 py-2 align-top">
                                        <code className="rounded-md border bg-card px-2 py-1 text-xs text-foreground">{it.key}</code>
                                      </td>
                                      <td className="px-3 py-2 align-top text-foreground">{it.before || '—'}</td>
                                      <td className="px-3 py-2 align-top text-foreground">{it.after || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                      {detailRecord.locale !== mockProject.sourceLocale ? (
                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-foreground">待审核列表</div>
                              <div className="mt-1 text-sm text-muted-foreground">目标语言上传导入/覆盖的译文会统一进入待审核。</div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/projects/${projectId}/workbench?locale=${encodeURIComponent(detailRecord.locale)}&status=pending_review`}>
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
                              <Link href={`/projects/${projectId}/workbench?status=has_update`}>
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
