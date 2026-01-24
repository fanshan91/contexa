import * as React from "react";

import { cn } from "@/lib/utils";

type LogoMarkProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

export function LogoMark({
  className,
  title = "Contexa TMS",
  ...props
}: LogoMarkProps) {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
      {...props}
    >
      <rect x="8" y="8" width="56" height="56" rx="14" fill="currentColor" />
      <path
        d="M24 30 C30 24, 42 24, 48 30"
        stroke="rgb(var(--primary-foreground))"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M22 38 C30 32, 42 32, 50 38"
        stroke="rgb(var(--primary-foreground))"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M24 46 C30 40, 42 40, 48 46"
        stroke="rgb(var(--primary-foreground))"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}
