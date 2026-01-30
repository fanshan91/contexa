import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps } from "react-hook-form";
import type { z } from "zod";

type UseZodFormOptions<TSchema extends z.ZodTypeAny> = Omit<
  UseFormProps<z.infer<TSchema>>,
  "resolver"
> & {
  schema: TSchema;
};

function useZodForm<TSchema extends z.ZodTypeAny>(
  options: UseZodFormOptions<TSchema>
) {
  const { schema, ...formOptions } = options;

  return useForm<z.infer<TSchema>>({
    ...formOptions,
    resolver: zodResolver(schema)
  });
}

export { useZodForm };

