"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive, Select as SelectPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

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

function MenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md outline-hidden",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

type SelectSingleProps = React.ComponentProps<typeof SelectPrimitive.Root> & {
  multiple?: false;
};

type SelectMultiProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.Root>,
  "children"
> & {
  multiple: true;
  values?: string[];
  defaultValues?: string[];
  onValuesChange?: (next: string[]) => void;
  disabled?: boolean;
  children?: React.ReactNode;
};

type SelectProps = SelectSingleProps | SelectMultiProps;

type SelectContextValue =
  | { multiple: false }
  | {
      multiple: true;
      disabled?: boolean;
      values: string[];
      setValues: (next: string[]) => void;
      getLabel: (value: string) => string | undefined;
      setLabel: (value: string, label: string) => void;
    };

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  return React.useContext(SelectContext);
}

function normalizeValues(input: unknown) {
  if (!Array.isArray(input)) return [];
  const next: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed || next.includes(trimmed)) continue;
    next.push(trimmed);
  }
  return next;
}

function extractText(node: React.ReactNode): string | undefined {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    for (const child of node) {
      const text = extractText(child);
      if (text) return text;
    }
  }
  return undefined;
}

function SelectRoot(props: SelectProps) {
  if ("multiple" in props && props.multiple) {
    const {
      multiple: _multiple,
      values,
      defaultValues,
      onValuesChange,
      disabled,
      children,
      ...dropdownMenuProps
    } = props;

    const isControlled = Array.isArray(values);
    const [uncontrolledValues, setUncontrolledValues] = React.useState(() =>
      normalizeValues(defaultValues)
    );
    const currentValues = isControlled ? normalizeValues(values) : uncontrolledValues;

    const setValues = React.useCallback(
      (next: string[]) => {
        const normalized = normalizeValues(next);
        if (!isControlled) setUncontrolledValues(normalized);
        onValuesChange?.(normalized);
      },
      [isControlled, onValuesChange]
    );

    const labelByValueRef = React.useRef<Map<string, string>>(new Map());
    const getLabel = React.useCallback((value: string) => labelByValueRef.current.get(value), []);
    const setLabel = React.useCallback((value: string, label: string) => {
      labelByValueRef.current.set(value, label);
    }, []);

    const ctxValue = React.useMemo<SelectContextValue>(
      () => ({
        multiple: true,
        disabled,
        values: currentValues,
        setValues,
        getLabel,
        setLabel
      }),
      [currentValues, disabled, getLabel, setLabel, setValues]
    );

    return (
      <SelectContext.Provider value={ctxValue}>
        <DropdownMenuPrimitive.Root data-slot="select" {...dropdownMenuProps}>
          {children}
        </DropdownMenuPrimitive.Root>
      </SelectContext.Provider>
    );
  }

  const { multiple: _multiple, ...singleProps } = props as SelectSingleProps;

  return (
    <SelectContext.Provider value={{ multiple: false }}>
      <SelectPrimitive.Root data-slot="select" {...singleProps} />
    </SelectContext.Provider>
  );
}

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  const ctx = useSelectContext();
  if (ctx?.multiple) {
    const { disabled, ...buttonProps } = props as any;
    const isDisabled = Boolean(ctx.disabled || disabled);

    return (
      <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" asChild>
        <button
          data-slot="select-trigger"
          {...buttonProps}
          type="button"
          disabled={isDisabled}
          className={cn(
            "border-input shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
            className
          )}
        >
          {children}
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
      </DropdownMenuPrimitive.Trigger>
    );
  }

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "border-input shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

function SelectContent(
  contentProps:
    | React.ComponentProps<typeof SelectPrimitive.Content>
    | React.ComponentProps<typeof DropdownMenuPrimitive.Content>
) {
  const ctx = useSelectContext();
  if (ctx?.multiple) {
    const { className, children, ...props } =
      contentProps as React.ComponentProps<typeof DropdownMenuPrimitive.Content>;

    return (
      <MenuContent data-slot="select-content" className={className} {...(props as any)}>
        {children}
      </MenuContent>
    );
  }

  const { className, children, position = "popper", ...props } = contentProps as React.ComponentProps<
    typeof SelectPrimitive.Content
  >;

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-hidden rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-slot="select-viewport"
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

type SelectItemProps =
  | React.ComponentProps<typeof SelectPrimitive.Item>
  | ({ value: string; label?: string } & Omit<
      React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>,
      "checked" | "onCheckedChange"
    >)
  | (React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { value?: undefined });

function SelectItem(props: SelectItemProps) {
  const ctx = useSelectContext();
  const isMultiple = ctx?.multiple === true;

  if (!isMultiple) {
    const { className, children, ...primitiveProps } = props as React.ComponentProps<
      typeof SelectPrimitive.Item
    >;

    return (
      <SelectPrimitive.Item
        data-slot="select-item"
        className={cn(
          "focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
        {...primitiveProps}
      >
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <CheckIcon className="size-4" />
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }

  const className = (props as any).className as string | undefined;
  const children = (props as any).children as React.ReactNode;
  const value = (props as any).value as string | undefined;

  const label = React.useMemo(() => {
    if (!value) return undefined;
    const explicit = (props as any).label as string | undefined;
    return explicit ?? extractText(children);
  }, [children, props, value]);

  React.useEffect(() => {
    if (!value || !label) return;
    ctx.setLabel(value, label);
  }, [ctx, label, value]);

  if (!value) {
    const { className, ...itemProps } = props as React.ComponentProps<typeof DropdownMenuPrimitive.Item>;
    return <MenuItem data-slot="select-item" className={className} {...itemProps} />;
  }

  const checked = ctx.values.includes(value);

  return (
    <MenuCheckboxItem
      data-slot="select-item"
      className={className}
      checked={checked}
      onCheckedChange={(next) => {
        const isChecked = next === true;
        const updated = isChecked
          ? checked
            ? ctx.values
            : [...ctx.values, value]
          : ctx.values.filter((v) => v !== value);
        ctx.setValues(updated);
      }}
      {...(props as any)}
    >
      {children}
    </MenuCheckboxItem>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  const ctx = useSelectContext();
  if (ctx?.multiple) {
    return (
      <MenuSeparator
        data-slot="select-separator"
        className={cn("bg-border -mx-1 my-1 h-px", className)}
        {...(props as any)}
      />
    );
  }

  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SelectAction = {
  key?: string;
  label: React.ReactNode;
  disabled?: boolean;
  keepOpen?: boolean;
  onSelect: () => void;
};

type SelectBaseFieldProps = {
  id?: string;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  options: SelectOption[];
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  position?: "item-aligned" | "popper";
};

type SelectRenderTriggerLabelArgs =
  | {
      multiple: false;
      value: string | undefined;
      option: SelectOption | undefined;
    }
  | {
      multiple: true;
      values: string[];
      options: SelectOption[];
    };

type SelectFieldSingleProps = SelectBaseFieldProps & {
  multiple?: false;
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderTriggerLabel?: (args: SelectRenderTriggerLabelArgs) => React.ReactNode;
};

type SelectFieldMultiProps = SelectBaseFieldProps & {
  multiple: true;
  values?: string[];
  defaultValues?: string[];
  onValuesChange?: (next: string[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  actions?: SelectAction[];
  renderTriggerLabel?: (args: SelectRenderTriggerLabelArgs) => React.ReactNode;
};

type SelectFieldProps = SelectFieldSingleProps | SelectFieldMultiProps;

function getOptionLabelText(option: SelectOption) {
  if (typeof option.label === "string") return option.label;
  return extractText(option.label);
}

function Select(props: SelectFieldProps) {
  if (props.multiple) {
    const {
      id,
      placeholder,
      disabled,
      options,
      values,
      defaultValues,
      onValuesChange,
      className,
      contentClassName,
      align = "start",
      open,
      onOpenChange,
      modal,
      actions,
      renderTriggerLabel
    } = props;

    const isControlled = Array.isArray(values);
    const [uncontrolledValues, setUncontrolledValues] = React.useState(() =>
      normalizeValues(defaultValues)
    );
    const currentValues = isControlled ? normalizeValues(values) : uncontrolledValues;

    const setValues = React.useCallback(
      (next: string[]) => {
        const normalized = normalizeValues(next);
        if (!isControlled) setUncontrolledValues(normalized);
        onValuesChange?.(normalized);
      },
      [isControlled, onValuesChange]
    );

    const defaultTriggerLabel = React.useMemo(() => {
      if (currentValues.length === 0) return placeholder ?? "";
      const textLabels = currentValues.map((v) => {
        const opt = options.find((o) => o.value === v);
        if (!opt) return v;
        return getOptionLabelText(opt) ?? v;
      });
      return textLabels.filter(Boolean).join(", ");
    }, [currentValues, options, placeholder]);

    const triggerLabel =
      renderTriggerLabel?.({ multiple: true, values: currentValues, options }) ?? defaultTriggerLabel;

    return (
      <SelectRoot
        multiple
        values={currentValues}
        onValuesChange={setValues}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange}
        modal={modal}
      >
        <SelectTrigger id={id} className={cn(className)}>
          <span
            className={cn(
              "truncate text-left",
              currentValues.length === 0 ? "text-muted-foreground" : undefined
            )}
          >
            {triggerLabel}
          </span>
        </SelectTrigger>
        <SelectContent
          align={align}
          style={{ width: "var(--radix-popper-anchor-width)" }}
          className={cn("max-h-72 max-w-[calc(100vw-2rem)]", contentClassName)}
        >
          {actions?.length ? (
            <>
              {actions.map((action) => (
                <SelectItem
                  key={action.key ?? getOptionLabelText({ value: "", label: action.label }) ?? String(action.label)}
                  disabled={action.disabled}
                  onSelect={(e) => {
                    if (action.keepOpen !== false) e.preventDefault();
                    action.onSelect();
                  }}
                >
                  {action.label}
                </SelectItem>
              ))}
              <SelectSeparator />
            </>
          ) : null}
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              label={getOptionLabelText(opt)}
              disabled={opt.disabled}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    );
  }

  const {
    id,
    placeholder,
    disabled,
    options,
    value,
    defaultValue,
    onValueChange,
    className,
    contentClassName,
    position = "popper",
    open,
    onOpenChange,
    renderTriggerLabel
  } = props;

  const isControlled = typeof value === "string";
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => defaultValue);
  const currentValue = isControlled ? value : uncontrolledValue;
  const currentOption = React.useMemo(
    () => options.find((opt) => opt.value === currentValue),
    [currentValue, options]
  );

  const triggerLabel =
    renderTriggerLabel?.({ multiple: false, value: currentValue, option: currentOption }) ??
    (currentOption?.label ?? (currentValue ? currentValue : placeholder ?? ""));

  return (
    <SelectRoot
      value={currentValue}
      onValueChange={(next) => {
        if (!isControlled) setUncontrolledValue(next);
        onValueChange?.(next);
      }}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger id={id} className={cn(className)}>
        <span className={cn("truncate text-left", !currentValue ? "text-muted-foreground" : undefined)}>
          {triggerLabel}
        </span>
      </SelectTrigger>
      <SelectContent
        position={position}
        style={{ width: "var(--radix-select-trigger-width)" }}
        className={cn("max-h-72 max-w-[calc(100vw-2rem)]", contentClassName)}
      >
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

export { Select, Select as CtxSelect };
