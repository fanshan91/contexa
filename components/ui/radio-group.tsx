"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export type RadioGroupOption = {
  key?: string;
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type RadioGroupProps = Omit<
  React.ComponentProps<typeof RadioGroupPrimitive.Root>,
  "children"
> & {
  options: RadioGroupOption[];
  optionClassName?: string;
  itemClassName?: string;
};

function RadioItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20  aria-invalid:border-destructive bg-card  aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

function RadioGroup({
  className,
  options,
  optionClassName,
  itemClassName,
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    >
      {options.map((option, idx) => {
        const key = option.key ?? `${option.value}-${idx}`;
        return (
          <Label
            key={key}
            data-slot="radio-group-option"
            className={cn("flex items-center gap-2 text-sm", optionClassName)}
          >
            <RadioItem
              className={itemClassName}
              value={option.value}
              disabled={option.disabled}
            />
            {option.label}
          </Label>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}

export { RadioGroup };

const CtxRadioGroup = RadioGroup;

export { CtxRadioGroup };
