'use client';

import { useMemo, useState } from 'react';
import { projectLocaleOptions, ProjectLocaleOption } from '@/lib/locales';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type LocaleSelectProps = {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  options?: ProjectLocaleOption[];
};

export function LocaleSelect({
  id,
  name,
  defaultValue,
  required,
  disabled,
  className,
  options = projectLocaleOptions
}: LocaleSelectProps) {
  const initialValue = useMemo(() => {
    if (defaultValue && options.some((o) => o.value === defaultValue)) return defaultValue;
    return options[0]?.value ?? '';
  }, [defaultValue, options]);

  const [value, setValue] = useState<string>(initialValue);
  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? value,
    [options, value]
  );

  return (
    <DropdownMenu>
      <input id={id} name={name} type="hidden" value={value} required={required} />
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'relative h-10 w-full justify-between rounded-full border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
            className
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDownIcon className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        style={{ width: 'var(--radix-popper-anchor-width)' }}
        className="max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
