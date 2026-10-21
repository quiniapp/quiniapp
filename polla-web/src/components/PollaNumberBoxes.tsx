import { KeyboardEvent, forwardRef, useImperativeHandle, useRef } from 'react';
import { POLLA_NUMBERS_REQUIRED } from '@helper/polla/types/game.type';
import { padPollaNumber } from '@/lib/pollaNumbers';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface PollaNumberBoxesHandle {
  focusFirst: () => void;
}

interface PollaNumberBoxesProps {
  values: string[];
  onChange: (values: string[]) => void;
  /** Enter en la última caja: recibe los valores ya completados con cero. */
  onSubmit?: (values: string[]) => void;
  label?: string;
}

/**
 * 10 cajas de 2 cifras. Igual que la carga de resultados de QuiniApp: se
 * escribe el número y Enter pasa a la caja siguiente (no salta solo al
 * completar las 2 cifras, así Enter nunca saltea una caja).
 */
export const PollaNumberBoxes = forwardRef<PollaNumberBoxesHandle, PollaNumberBoxesProps>(
  function PollaNumberBoxes({ values, onChange, onSubmit, label }, ref) {
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    useImperativeHandle(ref, () => ({
      focusFirst: () => inputRefs.current[0]?.focus(),
    }));

    const setValue = (index: number, value: string) => {
      const next = [...values];
      next[index] = value;
      onChange(next);
      return next;
    };

    const handleChange = (index: number, raw: string) => {
      setValue(index, raw.replace(/\D/g, '').slice(0, 2));
    };

    const handleBlur = (index: number) => {
      const padded = padPollaNumber(values[index]);
      if (padded !== values[index]) setValue(index, padded);
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!values[index]) return;

        const next = setValue(index, padPollaNumber(values[index]));

        if (index < POLLA_NUMBERS_REQUIRED - 1) {
          inputRefs.current[index + 1]?.focus();
        } else {
          onSubmit?.(next);
        }
        return;
      }

      if (e.key === 'Backspace' && !values[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <Label>
          {label ?? `Ingresá los ${POLLA_NUMBERS_REQUIRED} números (Enter para seguir)`}
        </Label>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
          {values.map((value, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <span className="text-[10px] leading-none text-muted-foreground">{index + 1}</span>
              <Input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                inputMode="numeric"
                enterKeyHint={index < POLLA_NUMBERS_REQUIRED - 1 ? 'next' : 'done'}
                maxLength={2}
                value={value}
                aria-label={`Número ${index + 1}`}
                onChange={(e) => handleChange(index, e.target.value)}
                onBlur={() => handleBlur(index)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                // 5 cajas por fila tienen que entrar en 320px menos los
                // padding de la página y de la tarjeta.
                className="!h-11 !w-11 px-0 text-center text-lg font-bold tabular-nums sm:!h-14 sm:!w-14 sm:text-2xl"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
);
