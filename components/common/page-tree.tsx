"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { Collapsible } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


type PageTreeNode = {
  id: string;
  label: React.ReactNode;
  href?: string;
  disabled?: boolean;
  children?: Array<PageTreeNode>;
};

type PageTreeProps = {
  nodes: Array<PageTreeNode>;
  currentId?: string;
  defaultExpandedIds?: Array<string>;
  onSelect?: (node: PageTreeNode) => void;
  className?: string;
};

function PageTree({
  nodes,
  currentId,
  defaultExpandedIds = [],
  onSelect,
  className
}: PageTreeProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(defaultExpandedIds)
  );

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div data-slot="page-tree" className={cn("space-y-1", className)}>
      {nodes.map((node) => (
        <PageTreeNodeItem
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          currentId={currentId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function PageTreeNodeItem({
  node,
  depth,
  expanded,
  toggle,
  currentId,
  onSelect
}: {
  node: PageTreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  currentId?: string;
  onSelect?: (node: PageTreeNode) => void;
}) {
  const hasChildren = !!node.children?.length;
  const isExpanded = hasChildren ? expanded.has(node.id) : false;
  const isCurrent = currentId === node.id;

  const content = (
    <Button
      type="button"
      variant={isCurrent ? "secondary" : "ghost"}
      size="sm"
      disabled={node.disabled}
      className={cn(
        "h-8 w-full justify-start gap-2 px-2",
        isCurrent && "text-foreground"
      )}
      onClick={() => {
        if (hasChildren) toggle(node.id);
        onSelect?.(node);
      }}
    >
      {hasChildren ? (
        <ChevronRightIcon
          className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")}
        />
      ) : (
        <span className="size-4" aria-hidden="true" />
      )}
      <span className="truncate">{node.label}</span>
    </Button>
  );

  if (!hasChildren) {
    return (
      <div data-slot="page-tree-item" style={{ paddingLeft: depth * 12 }}>
        {node.href ? (
          <Button asChild variant={isCurrent ? "secondary" : "ghost"} size="sm" className="h-8 w-full justify-start gap-2 px-2">
            <Link href={node.href} onClick={() => onSelect?.(node)}>
              <span className="size-4" aria-hidden="true" />
              <span className="truncate">{node.label}</span>
            </Link>
          </Button>
        ) : (
          content
        )}
      </div>
    );
  }

  return (
    <div data-slot="page-tree-group" style={{ paddingLeft: depth * 12 }}>
      <Collapsible
        open={isExpanded}
        onOpenChange={() => toggle(node.id)}
        trigger={content}
        contentClassName="ml-4 space-y-1"
      >
        {node.children!.map((child) => (
          <PageTreeNodeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            currentId={currentId}
            onSelect={onSelect}
          />
        ))}
      </Collapsible>
    </div>
  );
}

export { PageTree };
export type { PageTreeNode, PageTreeProps };
