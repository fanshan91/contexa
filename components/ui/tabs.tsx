"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type TabsItem = {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
};

type TabsComposableProps = React.ComponentProps<typeof TabsPrimitive.Root> & {
  items?: never;
  listClassName?: never;
  triggerClassName?: never;
  contentClassName?: never;
};

type TabsItemsProps = Omit<
  React.ComponentProps<typeof TabsPrimitive.Root>,
  "children"
> & {
  items: TabsItem[];
  listClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

type TabsProps = TabsComposableProps | TabsItemsProps;

function Tabs(props: TabsComposableProps): React.JSX.Element;
function Tabs(props: TabsItemsProps): React.JSX.Element;
function Tabs(props: TabsProps) {
  if ("items" in props) {
    const { items, listClassName, triggerClassName, contentClassName, ...rootProps } =
      props as TabsItemsProps;

    const defaultValue =
      rootProps.defaultValue ?? (rootProps.value ? undefined : items[0]?.value);

    return (
      <TabsPrimitive.Root
        data-slot="tabs"
        {...rootProps}
        defaultValue={defaultValue}
      >
        <TabsPrimitive.List
          data-slot="tabs-list"
          className={cn(
            "bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-md p-1",
            listClassName
          )}
        >
          {items.map((item) => (
            <TabsPrimitive.Trigger
              key={item.value}
              data-slot="tabs-trigger"
              className={cn(
                "focus-visible:border-ring focus-visible:ring-ring/50 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium outline-none transition-all focus-visible:ring-[2px] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                triggerClassName
              )}
              value={item.value}
              disabled={item.disabled}
            >
              {item.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {items.map((item) => (
          <TabsPrimitive.Content
            key={item.value}
            data-slot="tabs-content"
            className={cn(
              "focus-visible:border-ring focus-visible:ring-ring/50 mt-2 outline-none focus-visible:ring-[2px]",
              contentClassName
            )}
            value={item.value}
          >
            {item.content}
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    );
  }

  return <TabsPrimitive.Root data-slot="tabs" {...(props as TabsComposableProps)} />;
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-md p-1",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium outline-none transition-all focus-visible:ring-[2px] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 mt-2 outline-none focus-visible:ring-[2px]",
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
