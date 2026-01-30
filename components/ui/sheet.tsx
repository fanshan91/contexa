"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const sheetContentVariants = cva(
  "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 border p-6 shadow-lg outline-none transition ease-in-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left:
          "inset-y-0 left-0 h-full w-[calc(100vw-2rem)] max-w-sm border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md",
        right:
          "inset-y-0 right-0 h-full w-[calc(100vw-2rem)] max-w-sm border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md"
      }
    },
    defaultVariants: {
      side: "right"
    }
  }
);

type CtxSheetProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Root>,
  "open" | "defaultOpen" | "onOpenChange" | "children"
> &
  VariantProps<typeof sheetContentVariants> & {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
    footer?: React.ReactNode;
    children?: React.ReactNode;
    showClose?: boolean;
    contentClassName?: string;
    headerClassName?: string;
    footerClassName?: string;
  };

function CtxSheet({
  trigger,
  title,
  description,
  footer,
  children,
  open,
  defaultOpen,
  onOpenChange,
  side,
  showClose = true,
  contentClassName,
  headerClassName,
  footerClassName,
  ...props
}: CtxSheetProps) {
  return (
    <DialogPrimitive.Root
      data-slot="ctx-sheet"
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      {...props}
    >
      {trigger ? (
        <DialogPrimitive.Trigger data-slot="ctx-sheet-trigger" asChild>
          {trigger}
        </DialogPrimitive.Trigger>
      ) : null}

      <DialogPrimitive.Portal data-slot="ctx-sheet-portal">
        <DialogPrimitive.Overlay
          data-slot="ctx-sheet-overlay"
          className="bg-overlay/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50"
        />

        <DialogPrimitive.Content
          data-slot="ctx-sheet-content"
          className={cn(sheetContentVariants({ side }), contentClassName)}
        >
          {title || description ? (
            <div
              data-slot="ctx-sheet-header"
              className={cn("flex flex-col gap-1.5 text-center sm:text-left", headerClassName)}
            >
              {title ? (
                <DialogPrimitive.Title data-slot="ctx-sheet-title">{title}</DialogPrimitive.Title>
              ) : null}
              {description ? (
                <DialogPrimitive.Description data-slot="ctx-sheet-description">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
          ) : null}

          {children}

          {footer ? (
            <div
              data-slot="ctx-sheet-footer"
              className={cn(
                "mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                footerClassName
              )}
            >
              {footer}
            </div>
          ) : null}

          {showClose ? (
            <DialogPrimitive.Close
              data-slot="ctx-sheet-close"
              className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px] disabled:pointer-events-none"
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const Sheet = CtxSheet;

export { CtxSheet, Sheet };
export type { CtxSheetProps };
