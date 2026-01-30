"use client";

import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";
import {
  Controller,
  FormProvider,
  type ControllerProps,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  useFormContext,
  type UseFormStateReturn
} from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("space-y-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  const id = itemContext.id;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  };
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      data-slot="form-label"
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

function FormControl({ ...props }: React.ComponentProps<typeof SlotPrimitive.Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <SlotPrimitive.Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : children;

  if (!body) return null;

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm font-medium", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export type CtxFormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = Omit<ControllerProps<TFieldValues, TName>, "render"> & {
  className?: string;
  label?: React.ReactNode;
  labelClassName?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  messageClassName?: string;
  render: (
    field: ControllerRenderProps<TFieldValues, TName>,
    formState: UseFormStateReturn<TFieldValues>
  ) => React.ReactNode;
};

function CtxFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  className,
  label,
  labelClassName,
  description,
  descriptionClassName,
  messageClassName,
  render,
  ...controllerProps
}: CtxFormFieldProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: controllerProps.name }}>
      <Controller
        {...(controllerProps as ControllerProps<TFieldValues, TName>)}
        render={({ field, formState }) => (
          <FormItem className={className}>
            {label ? (
              <FormLabel className={labelClassName}>{label}</FormLabel>
            ) : null}
            <FormControl>{render(field, formState)}</FormControl>
            {description ? (
              <FormDescription className={descriptionClassName}>
                {description}
              </FormDescription>
            ) : null}
            <FormMessage className={messageClassName} />
          </FormItem>
        )}
      />
    </FormFieldContext.Provider>
  );
}

export { Form, CtxFormField as FormField };

const CtxForm = Form;

export { CtxForm, CtxFormField };
