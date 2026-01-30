"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

type AvatarProps = Omit<
  React.ComponentProps<typeof AvatarPrimitive.Root>,
  "children"
> & {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
  size?: AvatarSize;
  children?: React.ReactNode;
};

function Avatar({
  className,
  src,
  alt,
  fallback,
  size = "md",
  children,
  ...props
}: AvatarProps) {
  const sizeClassName =
    size === "sm" ? "size-6" : size === "lg" ? "size-10" : "size-8";

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        sizeClassName,
        className
      )}
      {...props}
    >
      {children ? (
        children
      ) : (
        <>
          {src ? <AvatarImage src={src} alt={alt} /> : null}
          <AvatarFallback>{fallback}</AvatarFallback>
        </>
      )}
    </AvatarPrimitive.Root>
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  );
}

const CtxAvatar = Avatar;

export { Avatar, CtxAvatar };
