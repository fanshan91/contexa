"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type TooltipComposableProps = React.ComponentProps<typeof TooltipPrimitive.Root> & {
  content?: never;
  contentClassName?: never;
  side?: never;
  align?: never;
  sideOffset?: never;
};

type TooltipContentProps = React.ComponentProps<typeof TooltipPrimitive.Content>;

type TooltipWithContentProps = Omit<
  React.ComponentProps<typeof TooltipPrimitive.Root>,
  "children"
> & {
  children: React.ReactElement;
  content: React.ReactNode;
  contentClassName?: string;
  side?: TooltipContentProps["side"];
  align?: TooltipContentProps["align"];
  sideOffset?: number;
};

type TooltipProps = TooltipComposableProps | TooltipWithContentProps;

function TooltipProvider(
  props: React.ComponentProps<typeof TooltipPrimitive.Provider>
) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" {...props} />;
}

function Tooltip(props: TooltipComposableProps): React.JSX.Element;
function Tooltip(props: TooltipWithContentProps): React.JSX.Element;
function Tooltip(props: TooltipProps) {
  if ("content" in props) {
    const { children, content, contentClassName, side, align, sideOffset = 6, ...rootProps } =
      props as TooltipWithContentProps;

    return (
      <TooltipPrimitive.Root data-slot="tooltip" {...rootProps}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          className={contentClassName}
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          {content}
        </TooltipContent>
      </TooltipPrimitive.Root>
    );
  }

  return <TooltipPrimitive.Root data-slot="tooltip" {...(props as TooltipComposableProps)} />;
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-50 max-w-[260px] rounded-md border px-3 py-1.5 text-sm shadow-md",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider as CtxTooltipProvider,
  Tooltip as CtxTooltip,
  TooltipTrigger as CtxTooltipTrigger,
  TooltipContent as CtxTooltipContent,
};
