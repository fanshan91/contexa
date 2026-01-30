"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportClassName?: string;
  scrollbar?: "vertical" | "horizontal" | "both" | "none";
};

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none p-0.5 transition-colors",
        orientation === "vertical" ? "h-full w-2.5 border-l border-l-transparent" : "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

function ScrollAreaViewport(props: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>) {
  const { className, ...rest } = props;
  return (
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      className={cn("h-full w-full rounded-[inherit]", className)}
      {...rest}
    />
  );
}

function ScrollAreaCorner(
  props: React.ComponentProps<typeof ScrollAreaPrimitive.Corner>
) {
  return <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" {...props} />;
}

function ScrollArea({ className, viewportClassName, scrollbar = "vertical", children, ...props }: ScrollAreaProps) {
  const showVertical = scrollbar === "vertical" || scrollbar === "both";
  const showHorizontal = scrollbar === "horizontal" || scrollbar === "both";
  const showCorner = showVertical && showHorizontal;

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaViewport className={viewportClassName}>{children}</ScrollAreaViewport>
      {showVertical ? <ScrollBar orientation="vertical" /> : null}
      {showHorizontal ? <ScrollBar orientation="horizontal" /> : null}
      {showCorner ? <ScrollAreaCorner /> : null}
    </ScrollAreaPrimitive.Root>
  );
}

export { ScrollArea };

const CtxScrollArea = ScrollArea;

export { CtxScrollArea };
