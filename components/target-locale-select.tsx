'use client';

import { useMemo } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { getProjectLocaleLabel } from '@/lib/locales';
import { cn } from '@/lib/utils';

type TargetLocaleSelectProps = {
  id?: string;
  targetLocales: string[];
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
};

export function TargetLocaleSelect({
  id,
  targetLocales,
  value,
  onValueChange,
  disabled,
  placeholder = '选择目标语种',
  className,
  align = 'start'
}: TargetLocaleSelectProps) {
  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ code: string; label: string }> = [];
    for (const code of targetLocales) {
      const trimmed = code.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      list.push({ code: trimmed, label: getProjectLocaleLabel(trimmed) });
    }
    return list;
  }, [targetLocales]);

  const selected = useMemo(() => {
    if (!value) return { code: '', label: '' };
    return { code: value, label: getProjectLocaleLabel(value) };
  }, [value]);

  const isDisabled = disabled || options.length === 0;

  return (
    <DropdownMenu
      trigger={
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={isDisabled}
          className={cn('h-10 justify-between', className)}
        >
          <span className={cn('truncate', !selected.code ? 'text-muted-foreground' : undefined)}>
            {selected.code ? (
              <>
                <span className="text-foreground">{selected.label}</span>
                <span className="ml-1 text-xs text-muted-foreground">{selected.code}</span>
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDownIcon className="size-4 opacity-60" />
        </Button>
      }
      contentProps={{
        align,
        style: { width: 'var(--radix-popper-anchor-width)' },
        className: 'max-w-[calc(100vw-2rem)] min-w-[220px]'
      }}
      items={[
        {
          type: 'radio-group',
          value,
          onValueChange,
          items: options.map((opt) => ({
            value: opt.code,
            label: (
              <span className="flex w-full items-center justify-between gap-3">
                <span className="text-foreground">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.code}</span>
              </span>
            )
          }))
        }
      ]}
    />
  );
}
