"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

type CollapsibleProps = Omit<
  React.ComponentProps<typeof CollapsiblePrimitive.Root>,
  "children"
> & {
  trigger?: React.ReactNode;
  contentClassName?: string;
  children?: React.ReactNode;
};

function Collapsible({
  trigger,
  contentClassName,
  children,
  ...props
}: CollapsibleProps) {
  return (
    <CollapsiblePrimitive.Root data-slot="collapsible" {...props}>
      {trigger != null ? (
        React.isValidElement(trigger) ? (
          <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" asChild>
            {trigger}
          </CollapsiblePrimitive.Trigger>
        ) : (
          <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger">
            {trigger}
          </CollapsiblePrimitive.Trigger>
        )
      ) : null}

      <CollapsiblePrimitive.Content
        data-slot="collapsible-content"
        className={contentClassName}
      >
        {children}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}

export { Collapsible };

const CtxCollapsible = Collapsible;
export { CtxCollapsible };
