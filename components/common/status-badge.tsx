import * as React from "react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";

type StatusBadgePreset = {
  label: string;
  variant: BadgeVariant;
};

const defaultPresets: Record<string, StatusBadgePreset> = {
  draft: { label: "草稿", variant: "secondary" },
  todo: { label: "待处理", variant: "warning" },
  in_progress: { label: "进行中", variant: "info" },
  reviewing: { label: "审核中", variant: "warning" },
  approved: { label: "已定版", variant: "success" },
  rejected: { label: "已拒绝", variant: "destructive" },
  archived: { label: "已归档", variant: "outline" }
};

function StatusBadge({
  status,
  label,
  presets,
  variant,
  ...props
}: React.ComponentProps<typeof Badge> & {
  status: string;
  label?: string;
  presets?: Record<string, StatusBadgePreset>;
  variant?: BadgeVariant;
}) {
  const preset = (presets ?? defaultPresets)[status];

  return (
    <Badge
      data-slot="status-badge"
      variant={variant ?? preset?.variant ?? "outline"}
      {...props}
    >
      {label ?? preset?.label ?? status}
    </Badge>
  );
}

export { StatusBadge };
