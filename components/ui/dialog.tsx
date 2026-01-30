"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogProps = Omit<React.ComponentProps<typeof DialogPrimitive.Root>, "children"> & {
  trigger?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  children?: React.ReactNode;
};

function Dialog({
  trigger,
  title,
  description,
  footer,
  header,
  closeOnOverlayClick = false,
  contentClassName,
  headerClassName,
  footerClassName,
  children,
  ...props
}: DialogProps) {
  const shouldRenderHeader = header != null || title != null || description != null;

  return (
    <DialogPrimitive.Root data-slot="dialog" {...props}>
      {trigger != null ? (
        React.isValidElement(trigger) ? (
          <DialogPrimitive.Trigger data-slot="dialog-trigger" asChild>
            {trigger}
          </DialogPrimitive.Trigger>
        ) : (
          <DialogPrimitive.Trigger data-slot="dialog-trigger">
            {trigger}
          </DialogPrimitive.Trigger>
        )
      ) : null}

      <DialogPrimitive.Portal data-slot="dialog-portal">
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="bg-overlay/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50"
        />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          onPointerDownOutside={(e) => {
            if (closeOnOverlayClick === false) {
              e.preventDefault();
            }
          }}
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border p-6 shadow-lg outline-none",
            contentClassName
          )}
        >
          {shouldRenderHeader ? (
            <div
              data-slot="dialog-header"
              className={cn("flex flex-col gap-1.5 text-center sm:text-left", headerClassName)}
            >
              {header ?? (
                <>
                  {title != null ? (
                    <DialogPrimitive.Title
                      data-slot="dialog-title"
                      className="text-lg leading-none font-semibold"
                    >
                      {title}
                    </DialogPrimitive.Title>
                  ) : null}
                  {description != null ? (
                    <DialogPrimitive.Description
                      data-slot="dialog-description"
                      className="text-muted-foreground text-sm"
                    >
                      {description}
                    </DialogPrimitive.Description>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {children}

          {footer != null ? (
            <div
              data-slot="dialog-footer"
              className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", footerClassName)}
            >
              {footer}
            </div>
          ) : null}

          <DialogPrimitive.Close
            data-slot="dialog-content-close"
            className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px] disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { Dialog };

const CtxDialog = Dialog;
export { CtxDialog };
