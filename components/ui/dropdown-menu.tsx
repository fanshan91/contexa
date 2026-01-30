"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type DropdownMenuItemBase = {
  key?: string;
};

type DropdownMenuSeparatorItem = DropdownMenuItemBase & {
  type: "separator";
};

type DropdownMenuLabelItem = DropdownMenuItemBase & {
  type: "label";
  label: React.ReactNode;
  inset?: boolean;
};

type DropdownMenuActionItem = DropdownMenuItemBase & {
  type: "item";
  label: React.ReactNode;
  className?: string;
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
  asChild?: boolean;
  shortcut?: React.ReactNode;
  onSelect?: React.ComponentProps<typeof DropdownMenuPrimitive.Item>["onSelect"];
};

type DropdownMenuCheckboxItem = DropdownMenuItemBase & {
  type: "checkbox";
  label: React.ReactNode;
  className?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: React.ComponentProps<
    typeof DropdownMenuPrimitive.CheckboxItem
  >["onCheckedChange"];
};

type DropdownMenuRadioGroupItem = DropdownMenuItemBase & {
  type: "radio-group";
  value?: string;
  onValueChange?: React.ComponentProps<
    typeof DropdownMenuPrimitive.RadioGroup
  >["onValueChange"];
  items: Array<{
    key?: string;
    value: string;
    label: React.ReactNode;
    disabled?: boolean;
  }>;
};

type DropdownMenuGroupItem = DropdownMenuItemBase & {
  type: "group";
  items: DropdownMenuItem[];
};

type DropdownMenuSubMenuItem = DropdownMenuItemBase & {
  type: "sub";
  label: React.ReactNode;
  inset?: boolean;
  items: DropdownMenuItem[];
};

export type DropdownMenuItem =
  | DropdownMenuActionItem
  | DropdownMenuCheckboxItem
  | DropdownMenuRadioGroupItem
  | DropdownMenuLabelItem
  | DropdownMenuSeparatorItem
  | DropdownMenuGroupItem
  | DropdownMenuSubMenuItem;

export type DropdownMenuProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.Root>,
  "children"
> & {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  triggerProps?: Omit<
    React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>,
    "children"
  >;
  contentProps?: Omit<
    React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
    "children"
  >;
};

function Shortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  );
}

function MenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function MenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function MenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function MenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function MenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        className
      )}
      {...props}
    />
  );
}

function renderItems(items: DropdownMenuItem[]): React.ReactNode {
  return items.map((item, idx) => {
    const key = item.key ?? `${item.type}-${idx}`;
    if (item.type === "separator") return <MenuSeparator key={key} />;
    if (item.type === "label") return <MenuLabel key={key} inset={item.inset}>{item.label}</MenuLabel>;
    if (item.type === "item") {
      return (
        <MenuItem
          key={key}
          className={item.className}
          inset={item.inset}
          variant={item.variant}
          disabled={item.disabled}
          onSelect={item.onSelect}
          asChild={item.asChild}
        >
          {item.asChild ? (
            (item.label as any)
          ) : (
            <>
              {item.label}
              {item.shortcut ? <Shortcut>{item.shortcut}</Shortcut> : null}
            </>
          )}
        </MenuItem>
      );
    }
    if (item.type === "checkbox") {
      return (
        <MenuCheckboxItem
          key={key}
          className={item.className}
          checked={item.checked}
          disabled={item.disabled}
          onCheckedChange={item.onCheckedChange}
        >
          {item.label}
        </MenuCheckboxItem>
      );
    }
    if (item.type === "radio-group") {
      return (
        <DropdownMenuPrimitive.RadioGroup
          key={key}
          data-slot="dropdown-menu-radio-group"
          value={item.value}
          onValueChange={item.onValueChange}
        >
          {item.items.map((radioItem, radioIdx) => {
            const radioKey = radioItem.key ?? `${key}-radio-${radioIdx}`;
            return (
              <MenuRadioItem
                key={radioKey}
                value={radioItem.value}
                disabled={radioItem.disabled}
              >
                {radioItem.label}
              </MenuRadioItem>
            );
          })}
        </DropdownMenuPrimitive.RadioGroup>
      );
    }
    if (item.type === "group") {
      return (
        <DropdownMenuPrimitive.Group key={key} data-slot="dropdown-menu-group">
          {renderItems(item.items)}
        </DropdownMenuPrimitive.Group>
      );
    }
    if (item.type === "sub") {
      return (
        <DropdownMenuPrimitive.Sub key={key} data-slot="dropdown-menu-sub">
          <MenuSubTrigger inset={item.inset}>{item.label}</MenuSubTrigger>
          <MenuSubContent>{renderItems(item.items)}</MenuSubContent>
        </DropdownMenuPrimitive.Sub>
      );
    }
    return null;
  });
}

function DropdownMenu({
  trigger,
  items,
  triggerProps,
  contentProps,
  ...rootProps
}: DropdownMenuProps) {
  const { className, sideOffset = 4, ...restContentProps } = contentProps ?? {};

  return (
    <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...rootProps}>
      <DropdownMenuPrimitive.Trigger
        data-slot="dropdown-menu-trigger"
        asChild
        {...triggerProps}
      >
        {trigger as any}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          data-slot="dropdown-menu-content"
          sideOffset={sideOffset}
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
            className
          )}
          {...(restContentProps as any)}
        >
          {renderItems(items)}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export { DropdownMenu };

const CtxDropdownMenu = DropdownMenu;

export { CtxDropdownMenu };
