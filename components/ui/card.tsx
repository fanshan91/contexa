import * as React from "react";

import { cn } from "@/lib/utils";

type CardProps = Omit<React.ComponentProps<"div">, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
};

function Card({
  className,
  title,
  description,
  action,
  footer,
  header,
  headerClassName,
  contentClassName,
  footerClassName,
  children,
  ...props
}: CardProps) {
  const shouldRenderHeader = header != null || title != null || description != null || action != null;

  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    >
      {shouldRenderHeader ? (
        <div
          data-slot="card-header"
          className={cn(
            "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
            headerClassName
          )}
        >
          {header ?? (
            <>
              {title != null ? (
                <div data-slot="card-title" className="leading-none font-semibold">
                  {title}
                </div>
              ) : null}
              {description != null ? (
                <div data-slot="card-description" className="text-muted-foreground text-sm">
                  {description}
                </div>
              ) : null}
              {action != null ? (
                <div
                  data-slot="card-action"
                  className="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
                >
                  {action}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {children != null ? (
        <div data-slot="card-content" className={cn("px-6", contentClassName)}>
          {children}
        </div>
      ) : null}

      {footer != null ? (
        <div
          data-slot="card-footer"
          className={cn("flex items-center px-6 [.border-t]:pt-6", footerClassName)}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export { Card };

const CtxCard = Card;
export { CtxCard };
