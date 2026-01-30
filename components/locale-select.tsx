'use client';

import { useMemo, useState } from 'react';
import { projectLocaleOptions, ProjectLocaleOption } from '@/lib/locales';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type LocaleSelectProps = {
  id: string;
  name: string;
  defaultValue?: string;
  defaultValues?: string[];
  required?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  placeholder?: string;
  onValueChange?: (next: string) => void;
  onValuesChange?: (next: string[]) => void;
  className?: string;
  options?: ProjectLocaleOption[];
};

/** 通用的 语言下拉选择组件 */
export function LocaleSelect({
  id,
  name,
  defaultValue,
  defaultValues,
  required,
  disabled,
  multiple,
  placeholder,
  onValueChange,
  onValuesChange,
  className,
  options = projectLocaleOptions
}: LocaleSelectProps) {
  const initialValue = useMemo(() => {
    if (multiple) return '';
    if (defaultValue && options.some((o) => o.value === defaultValue)) return defaultValue;
    return options[0]?.value ?? '';
  }, [defaultValue, multiple, options]);

  const initialValues = useMemo(() => {
    if (!multiple) return [];
    const incoming = defaultValues ?? (defaultValue ? [defaultValue] : []);
    const allowed = new Set(options.map((o) => o.value));
    const unique: string[] = [];
    for (const v of incoming) {
      const trimmed = v.trim();
      if (!trimmed || !allowed.has(trimmed) || unique.includes(trimmed)) continue;
      unique.push(trimmed);
    }
    return unique;
  }, [defaultValue, defaultValues, multiple, options]);

  const [value, setValue] = useState<string>(initialValue);
  const [values, setValues] = useState<string[]>(initialValues);
  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? value,
    [options, value]
  );

  const selectedLabels = useMemo(() => {
    const labelByValue = new Map(options.map((o) => [o.value, o.label]));
    return values.map((v) => labelByValue.get(v) ?? v);
  }, [options, values]);

  const buttonLabel = useMemo(() => {
    if (!multiple) return selectedLabel;
    if (values.length === 0) return placeholder ?? '选择语言';
    if (values.length === 1) return selectedLabels[0] ?? values[0];
    if (values.length <= 3) return selectedLabels.join(', ');
    return `${values.length} 个语言`;
  }, [multiple, placeholder, selectedLabel, selectedLabels, values]);

  const isDisabled = disabled || options.length === 0;

  return (
    <>
      <input
        id={id}
        name={name}
        type="hidden"
        value={multiple ? values.join(',') : value}
        required={required}
      />
      {multiple ? (
        <Select
          multiple
          values={values}
          defaultValues={defaultValues}
          disabled={isDisabled}
          placeholder={placeholder ?? '选择语言'}
          className={cn('h-10 w-full justify-between', className)}
          contentClassName="max-h-72 max-w-[calc(100vw-2rem)]"
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          renderTriggerLabel={() => buttonLabel}
          onValuesChange={(next) => {
            setValues(next);
            onValuesChange?.(next);
          }}
        />
      ) : (
        <Select
          value={value}
          disabled={isDisabled}
          placeholder={placeholder ?? '选择语言'}
          className={cn('h-10 w-full justify-between', className)}
          contentClassName="max-h-72 max-w-[calc(100vw-2rem)]"
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          renderTriggerLabel={() => buttonLabel}
          onValueChange={(next) => {
            setValue(next);
            onValueChange?.(next);
          }}
        />
      )}
    </>
  );
}
