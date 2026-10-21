import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

type DateInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'min' | 'max'
> & {
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
};

/**
 * Fecha con el calendario nativo. En desktop el calendario solo se abría desde
 * el ícono de la derecha y, después de elegir una vez, un click en el texto
 * solo dejaba tipear: ahora cualquier click lo abre. Un valor vacío se ignora y
 * uno tipeado fuera de `min`/`max` se lleva al límite (el calendario ya no deja
 * elegirlo, pero el tipeo sí).
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onValueChange, min, max, onClick, className, ...props }, ref) => (
    <Input
      ref={ref}
      type="date"
      value={value}
      min={min}
      max={max}
      className={cn('cursor-pointer', className)}
      onClick={(e) => {
        onClick?.(e);
        try {
          e.currentTarget.showPicker?.();
        } catch {
          // Navegador sin soporte o el calendario ya abierto: queda el tipeo.
        }
      }}
      onChange={(e) => {
        const next = e.target.value;
        if (!next) return;
        if (max && next > max) onValueChange(max);
        else if (min && next < min) onValueChange(min);
        else onValueChange(next);
      }}
      {...props}
    />
  )
);

DateInput.displayName = 'DateInput';
