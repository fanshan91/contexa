import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  onChange: (next: number) => void;
  pending?: boolean;
  className?: string;
  prevLabel?: React.ReactNode;
  nextLabel?: React.ReactNode;
};

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
  pending,
  className,
  prevLabel = "上一页",
  nextLabel = "下一页"
}: PaginationProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="text-sm text-muted-foreground">第 {page} / {pageCount} 页 · 共 {total} 条</div>
      <div className="flex items-center justify-end gap-2">
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

