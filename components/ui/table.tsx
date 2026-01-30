import * as React from "react";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  Table as TablePrimitive,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table-primitives";

type TableColumn<TData> = {
  key: string;
  title: React.ReactNode;
  dataIndex?: keyof TData;
  render?: (value: unknown, record: TData, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  align?: "left" | "center" | "right";
  width?: number | string;
};

type TableProps<TData> = {
  columns: Array<TableColumn<TData>>;
  data: Array<TData>;
  rowKey?: keyof TData | ((record: TData, index: number) => React.Key);
  caption?: React.ReactNode;
  emptyText?: React.ReactNode;
  onRowClick?: (record: TData) => void;
  className?: string;
  tableClassName?: string;
  loading?: boolean;
  loadingText?: React.ReactNode;
};

function Table<TData>({
  columns,
  data,
  rowKey,
  caption,
  emptyText = "暂无数据",
  onRowClick,
  className,
  tableClassName,
  loading,
  loadingText
}: TableProps<TData>) {
  const isLoading = Boolean(loading);

  return (
    <div
      data-slot="table"
      className={cn("relative w-full", className)}
      aria-busy={isLoading || undefined}
    >
      <TablePrimitive className={cn(isLoading && "opacity-60", tableClassName)}>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.headerClassName
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.length ? (
            data.map((record, index) => {
              const key =
                typeof rowKey === "function"
                  ? rowKey(record, index)
                  : typeof rowKey === "string"
                    ? (record as Record<string, unknown>)[rowKey as string]
                    : index;

              return (
                <TableRow
                  key={String(key)}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(record) : undefined}
                >
                  {columns.map((col) => {
                    const value =
                      typeof col.dataIndex === "string"
                        ? (record as Record<string, unknown>)[col.dataIndex]
                        : (record as Record<string, unknown>)[col.key];

                    return (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.cellClassName
                        )}
                      >
                        {col.render ? col.render(value, record, index) : (value as React.ReactNode)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>

        {caption ? <TableCaption>{caption}</TableCaption> : null}
      </TablePrimitive>

      {isLoading ? (
        <div
          data-slot="table-loading"
          className="pointer-events-none absolute inset-0 flex items-start justify-end p-2"
        >
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{loadingText ?? "更新中"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { Table };
export type { TableColumn, TableProps };
