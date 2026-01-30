import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: React.ReactNode;
  href?: string;
  current?: boolean;
};

type BreadcrumbProps = Omit<React.ComponentProps<"nav">, "children"> & {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  listClassName?: string;
};

function Breadcrumb({
  items,
  separator = "/",
  className,
  listClassName,
  ...props
}: BreadcrumbProps) {
  return (
    <nav
      data-slot="breadcrumb"
      aria-label="breadcrumb"
      className={className}
      {...props}
    >
      <ol
        data-slot="breadcrumb-list"
        className={cn(
          "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm",
          listClassName
        )}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = item.current ?? isLast;

          return (
            <React.Fragment key={index}>
              <li
                data-slot="breadcrumb-item"
                className="inline-flex items-center gap-1.5"
              >
                {item.href && !isCurrent ? (
                  <Link
                    data-slot="breadcrumb-link"
                    className="hover:text-foreground transition-colors"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    data-slot="breadcrumb-page"
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "text-foreground",
                      isCurrent ? "font-medium" : undefined
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </li>

              {isLast ? null : (
                <li
                  data-slot="breadcrumb-separator"
                  aria-hidden="true"
                  className="text-muted-foreground [&>svg]:size-3.5"
                >
                  {separator}
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

const CtxBreadcrumb = Breadcrumb;

export { Breadcrumb, CtxBreadcrumb };
