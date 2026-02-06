'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { listPackagesContextNodesQuery, type PackagesContextPageNode } from './actions';

export function useSearchPagination<T>({
  items,
  query,
  pageSize,
  predicate
}: {
  items: T[];
  query: string;
  pageSize: number;
  predicate: (item: T, q: string) => boolean;
}) {
  const [page, setPage] = useState(1);
  const normalized = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalized) return items;
    return items.filter((it) => predicate(it, normalized));
  }, [items, normalized, predicate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageCount, pageSize]);

  const setSafePage = (next: number) => {
    setPage(Math.min(Math.max(1, next), pageCount));
  };

  return { page, setPage: setSafePage, pageCount, filteredTotal: filtered.length, pageItems };
}

export function useContextNodes(projectId: number) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PackagesContextPageNode[]>([]);
  const inflightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(
    async (force?: boolean) => {
      if (busy) return;
      if (!force && loaded) return;
      if (!force && inflightRef.current) {
        await inflightRef.current;
        return;
      }

      setBusy(true);
      setError(null);

      const task = (async () => {
        try {
          const res = await listPackagesContextNodesQuery(projectId);
          if (!res.ok) {
            setError(res.error);
            setPages([]);
            setLoaded(true);
            return;
          }
          setPages(res.data.pages);
          setLoaded(true);
        } catch {
          setError('加载页面/模块失败，请重试。');
          setPages([]);
          setLoaded(true);
        } finally {
          setBusy(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = task;
      await task;
    },
    [busy, loaded, projectId]
  );

  return {
    loaded,
    busy,
    error,
    pages,
    load
  };
}
