"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  onChange: (next: number) => void;
  pageSize?: number;
  onPageSizeChange?: (next: number) => void;
  pageSizeOptions?: number[];
  pending?: boolean;
  className?: string;
  prevLabel?: React.ReactNode;
  nextLabel?: React.ReactNode;
  pageSizeLabel?: React.ReactNode;
  gotoLabel?: React.ReactNode;
  gotoPlaceholder?: string;
  showGoto?: boolean;
};

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  pending,
  className,
  prevLabel = "上一页",
  nextLabel = "下一页",
  pageSizeLabel = "每页",
  gotoLabel = "跳转",
  gotoPlaceholder = "页码",
  showGoto = true
}: PaginationProps) {
  const showPageSize = typeof pageSize === "number" && typeof onPageSizeChange === "function";
  const [jumpTo, setJumpTo] = React.useState(String(page));

  React.useEffect(() => {
    setJumpTo(String(page));
  }, [page]);

  const normalizedPageSizeOptions = React.useMemo(() => {
    const base = Array.isArray(pageSizeOptions) ? pageSizeOptions : [];
    const normalized = base
      .map((v) => Math.floor(v))
      .filter((v) => Number.isFinite(v) && v > 0)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);

    if (typeof pageSize === "number" && Number.isFinite(pageSize) && !normalized.includes(pageSize)) {
      return [...normalized, pageSize].sort((a, b) => a - b);
    }

    return normalized;
  }, [pageSize, pageSizeOptions]);

  const clampPage = React.useCallback(
    (next: number) => Math.min(Math.max(1, next), Math.max(1, pageCount)),
    [pageCount]
  );

  const jump = React.useCallback(() => {
    const raw = jumpTo.trim();
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = clampPage(Math.floor(parsed));
    if (next === page) return;
    onChange(next);
  }, [clampPage, jumpTo, onChange, page]);

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="text-sm text-muted-foreground">第 {page} / {pageCount} 页 · 共 {total} 条</div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showPageSize ? (
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">{pageSizeLabel}</div>
            <div className="w-[120px]">
              <Select
                value={String(pageSize)}
                disabled={pending}
                options={normalizedPageSizeOptions.map((v) => ({
                  value: String(v),
                  label: `${v} / 页`
                }))}
                onValueChange={(next) => onPageSizeChange(Number(next))}
              />
            </div>
          </div>
        ) : null}

        {showGoto && pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <div className="w-[90px]">
              <Input
                value={jumpTo}
                onChange={(e) => setJumpTo(e.target.value)}
                placeholder={gotoPlaceholder}
                inputMode="numeric"
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  jump();
                }}
              />
            </div>
            <Button size="sm" variant="outline" disabled={pending} onClick={jump}>
              {gotoLabel}
            </Button>
          </div>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1 || pending}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          {prevLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pageCount || pending}
          onClick={() => onChange(Math.min(pageCount, page + 1))}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
