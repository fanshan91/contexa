"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export type PopoverProps = Omit<
  React.ComponentProps<typeof PopoverPrimitive.Root>,
  "children"
> & {
  trigger: React.ReactNode;
  content: React.ReactNode;
  triggerProps?: Omit<
    React.ComponentProps<typeof PopoverPrimitive.Trigger>,
    "children"
  >;
  contentProps?: Omit<
    React.ComponentProps<typeof PopoverPrimitive.Content>,
    "children"
  >;
};

function Popover({
  trigger,
  content,
  triggerProps,
  contentProps,
  ...rootProps
}: PopoverProps) {
  const {
    className,
    align = "center",
    sideOffset = 4,
    ...restContentProps
  } = contentProps ?? {};

  return (
    <PopoverPrimitive.Root data-slot="popover" {...rootProps}>
      <PopoverPrimitive.Trigger
        data-slot="popover-trigger"
        asChild
        {...triggerProps}
      >
        {trigger as any}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="popover-content"
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "bg-popover text-popover-foreground z-50 w-72 rounded-md border shadow-md outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...(restContentProps as any)}
        >
          {content}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { Popover };

const CtxPopover = Popover;

export { CtxPopover };
