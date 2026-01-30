import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        outline: "text-foreground",
        destructive: "bg-destructive text-destructive-foreground border-transparent",
        success: "bg-success text-success-foreground border-transparent",
        warning: "bg-warning text-warning-foreground border-transparent",
        info: "bg-info text-info-foreground border-transparent"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

function Badge({
  className,
  variant,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

const CtxBadge = Badge;

export { Badge, CtxBadge };
