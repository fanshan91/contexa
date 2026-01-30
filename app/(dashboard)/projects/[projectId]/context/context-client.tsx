'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  createModuleAction,
  createPageAction,
  deleteModuleAction,
  deletePageAction
} from './actions';
import {
  ensureSelectedNode,
  normalizeKey,
  resolveSelection,
  type ContextPage,
  type SelectedNode
} from './context-model';
import { ContextDetailsPanel } from './context-details-panel';
import { ContextEntriesPanel } from './context-entries-panel';
import { ContextNodePicker } from './context-node-picker';
import { ContextStructureTree } from './context-structure-tree';

function SmallTag({ children }: { children: ReactNode }) {
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

export default function ProjectContextClient({
  projectId,
  initialPages
}: {
  projectId: number;
  initialPages: ContextPage[];
}) {
  const t = useTranslations('projectContext');
  const router = useRouter();
  const { push } = useToast();
  const [isPending, startTransition] = useTransition();

  const pages = initialPages;

  const [selected, setSelected] = useState<SelectedNode | null>(() =>
    ensureSelectedNode(pages, null)
  );

  useEffect(() => {
    setSelected((prev) => ensureSelectedNode(pages, prev));
  }, [pages]);

  const selection = useMemo(() => resolveSelection(pages, selected), [pages, selected]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'page' | 'module'>('page');
  const [createDraft, setCreateDraft] = useState({
    route: '',
    title: '',
    moduleName: ''
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const canCreateModule = selection?.type === 'page';

  const openCreateDialog = (type: 'page' | 'module') => {
    setCreateType(type);
    setCreateDraft({ route: '', title: '', moduleName: '' });
    setCreateDialogOpen(true);
  };

  const createPrimaryDisabled =
    createType === 'page'
      ? normalizeKey(createDraft.route).length === 0
      : normalizeKey(createDraft.moduleName).length === 0;

  const handleCreate = () => {
    startTransition(async () => {
      if (createType === 'page') {
        const title = createDraft.title.trim();
        const res = await createPageAction({
          projectId,
          route: normalizeKey(createDraft.route),
          title: title.length > 0 ? title : undefined,
          description: ''
        });

        if (!res.ok) {
          push({ variant: 'destructive', message: res.error });
          return;
        }

        push({ variant: 'default', message: res.success });
        setCreateDialogOpen(false);
        router.refresh();
        return;
      }

      if (!selection || selection.type !== 'page') return;

      const res = await createModuleAction({
        projectId,
        pageId: selection.page.id,
        name: normalizeKey(createDraft.moduleName),
        description: ''
      });

      if (!res.ok) {
        push({ variant: 'destructive', message: res.error });
        return;
      }

      push({ variant: 'default', message: res.success });
      setCreateDialogOpen(false);
      router.refresh();
    });
  };

  const handleDeleteSelected = () => {
    if (!selection) return;

    startTransition(async () => {
      const res =
        selection.type === 'page'
          ? await deletePageAction({ projectId, pageId: selection.page.id })
          : selection.module
            ? await deleteModuleAction({ projectId, moduleId: selection.module.id })
            : null;

      if (!res) return;

      if (!res.ok) {
        push({ variant: 'destructive', message: res.error });
        return;
      }

      push({ variant: 'default', message: res.success });
      setDeleteDialogOpen(false);
      setSelected(null);
      router.refresh();
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
          {/* <div className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</div> */}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="lg:hidden">
            <ContextNodePicker
              pages={pages}
              selected={selected}
              onSelect={(next) => setSelected(next)}
              disabled={isPending || pages.length === 0}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => openCreateDialog('page')}
            className="shadow-none"
            disabled={isPending}
          >
            <Plus className="h-4 w-4" />
            {t('actions.newPage')}
          </Button>
          <Button
            variant="outline"
            onClick={() => openCreateDialog('module')}
            className="shadow-none"
            disabled={!canCreateModule || isPending}
          >
            <Plus className="h-4 w-4" />
            {t('actions.newModule')}
          </Button>
          <Button
            variant="outline"
            className="shadow-none"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!selection || isPending}
          >
            <Trash2 className="h-4 w-4" />
            {t('actions.delete')}
          </Button>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[420px_1fr]">
        {!selection ? (
          <div className="h-full lg:col-span-2">
            <EmptyState title={t('detail.noSelectionTitle')} desc={t('detail.noSelectionDesc')} />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex flex-col gap-4">
              <ContextStructureTree
                pages={pages}
                selected={selected}
                onSelect={(next) => setSelected(next)}
                disabled={isPending || pages.length === 0}
                className="hidden lg:flex flex-1"
              />
              <div className="shrink-0">
                <ContextDetailsPanel
                  projectId={projectId}
                  selection={selection}
                  isPending={isPending}
                  startTransition={startTransition}
                />
              </div>
            </div>
            <div className="min-h-0">
              <ContextEntriesPanel
                projectId={projectId}
                selection={selection}
                isPending={isPending}
                startTransition={startTransition}
              />
            </div>
          </>
        )}
      </div>

      <Dialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        contentClassName="max-w-xl"
        title={createType === 'page' ? t('create.pageTitle') : t('create.moduleTitle')}
        footer={
          <>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setCreateDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createPrimaryDisabled || (!canCreateModule && createType === 'module') || isPending
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
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
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        contentClassName="max-w-xl"
        title={t('delete.title')}
        footer={
          <>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={!selection || isPending}
            >
              {t('common.confirmDelete')}
            </Button>
          </>
        }
      >
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-secondary-foreground">
              {selection
                ? selection.type === 'page'
                  ? t('delete.pageHint')
                  : t('delete.moduleHint')
                : t('delete.noSelection')}
            </div>
            {selection ? (
              <div className="rounded-lg border border-border bg-background px-3 py-2 ring-1 ring-ring/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{t('delete.target')}</div>
                    <div className="mt-0.5 truncate font-medium text-foreground">
                      {selection.type === 'page'
                        ? selection.page.title
                          ? selection.page.title
                          : t('tree.untitledPage')
                        : selection.module?.name ?? '-'}
                    </div>
                    {selection.type === 'module' ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {selection.page.title ? selection.page.title : t('tree.untitledPage')}
                      </div>
                    ) : null}
                  </div>
                  <SmallTag>
                    {selection.type === 'page' ? t('nodeType.page') : t('nodeType.module')}
                  </SmallTag>
                </div>
              </div>
            ) : null}
          </div>
      </Dialog>
    </div>
  );
}
