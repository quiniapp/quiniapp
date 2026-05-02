import { Flex } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import * as React from 'react';
import { useFormContext, FieldValues, Path } from 'react-hook-form';
import { ErrorMessage } from '../atoms/ErrorMessage';

type BaseProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  type?: React.ComponentProps<'input'>['type'];
  readOnly?: boolean;
  suffix?: string; // ejemplo: '%'
  inputClassName?: string;
  disabled?: boolean;
};
function LabelInputForm<T extends FieldValues>({
  name,
  label,
  type = 'text',
  readOnly = false,
  suffix,
  inputClassName,
  disabled = false,
}: BaseProps<T>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<T>();
  const id = React.useId();
  const isNumber = type === 'number';

  return (
    <Flex className="p-1 gap-1 sm:gap-4 items-center">
      <Label htmlFor={id} className="text-center text-nowrap text-xs sm:text-sm">
        {label}
      </Label>

      <div className="relative">
        <Input
          id={id}
          type={isNumber ? 'text' : type}
          inputMode={isNumber ? 'decimal' : undefined}
          readOnly={readOnly}
          disabled={disabled}
          className={`${inputClassName} text-white`}
          {...register(name, {
            setValueAs: isNumber
              ? (v) => {
                  if (v === '' || v === null || v === undefined) return 0;
                  const parsed = parseFloat(String(v).replace(',', '.'));
                  return isNaN(parsed) ? 0 : parsed;
                }
              : undefined,
          })}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>

      {/* Error inline (opcional) */}
      {errors?.[name as string] && (
        <ErrorMessage size="xs">
          {(errors[name as keyof typeof errors]?.message as string) ?? 'Inválido'}
        </ErrorMessage>
      )}
    </Flex>
  );
}

export default LabelInputForm;
