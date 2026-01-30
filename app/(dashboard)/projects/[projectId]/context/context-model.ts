export type ContextEntry = {
  id: number;
  key: string;
  sourceText: string | null;
  updatedAt: string;
};

export type ContextModule = {
  id: number;
  pageId: number;
  name: string;
  description: string | null;
  keyCount?: number;
  updatedAt: string;
};

export type ContextPage = {
  id: number;
  projectId: number;
  route: string;
  title: string | null;
  description: string | null;
  keyCount?: number;
  updatedAt: string;
  modules: ContextModule[];
};

export type SelectedNode =
  | { type: 'page'; pageId: number }
  | { type: 'module'; pageId: number; moduleId: number };

export type ResolvedSelection =
  | { type: 'page'; page: ContextPage; module: null }
  | { type: 'module'; page: ContextPage; module: ContextModule | null };

export function resolveSelection(
  pages: ContextPage[],
  selected: SelectedNode | null
): ResolvedSelection | null {
  if (!selected) return null;
  const page = pages.find((p) => p.id === selected.pageId) ?? null;
  if (!page) return null;

  if (selected.type === 'page') {
    return { type: 'page', page, module: null };
  }

  const module = page.modules.find((m) => m.id === selected.moduleId) ?? null;
  return { type: 'module', page, module };
}

export function ensureSelectedNode(
  pages: ContextPage[],
  selected: SelectedNode | null
): SelectedNode | null {
  if (pages.length === 0) return null;
  if (!selected) return { type: 'page', pageId: pages[0].id };

  const page = pages.find((p) => p.id === selected.pageId);
  if (!page) return { type: 'page', pageId: pages[0].id };

  if (selected.type === 'page') return selected;

  const hasModule = page.modules.some((m) => m.id === selected.moduleId);
  if (!hasModule) return { type: 'page', pageId: page.id };
  return selected;
}

export function formatCompactTime(iso?: string) {
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

export function normalizeKey(value: string) {
  return value.trim();
}
