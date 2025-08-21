import { Flex } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import * as React from 'react';
import { useFormContext, FieldValues, Path } from 'react-hook-form';

type BaseProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  type?: React.ComponentProps<'input'>['type'];
  readOnly?: boolean;
  suffix?: string; // ejemplo: '%'
  inputClassName?: string;
};
function LabelInputForm<T extends FieldValues>({
  name,
  label,
  type = 'text',
  readOnly = false,
  suffix,
  inputClassName,
}: BaseProps<T>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<T>();
  const id = React.useId();
  const isNumber = type === 'number';

  return (
    <Flex className="p-1 gap-1 sm:gap-4 items-center">
      <Label htmlFor={id} className="text-white text-center text-nowrap text-xs sm:text-sm">
        {label}
      </Label>

      <div className="relative">
        <Input
          id={id}
          type={type}
          readOnly={readOnly}
          className={`${inputClassName} text-white`}
          {...register(name, { valueAsNumber: isNumber })}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>

      {/* Error inline (opcional) */}
      {errors?.[name as string] && (
        <span className="text-red-500 text-xs">
          {(errors[name as keyof typeof errors]?.message as string) ?? 'Inválido'}
        </span>
      )}
    </Flex>
  );
}

export default LabelInputForm;
