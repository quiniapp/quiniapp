import { useMemo, useRef } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';

export const POLLA_NUMBERS_REQUIRED = 10;

export const createEmptyPollaNumbers = (): string[] => Array(POLLA_NUMBERS_REQUIRED).fill('');

export const pollaNumbersError = (values: string[]): string | null => {
  if (values.some((v) => !/^\d{2}$/.test(v))) {
    return `Debés completar los ${POLLA_NUMBERS_REQUIRED} números`;
  }
  if (new Set(values).size !== values.length) {
    return 'Los 10 números deben ser distintos';
  }
  return null;
};

interface PollaNumberBoxesProps {
  values: string[];
  onChange: (values: string[]) => void;
}

export const PollaNumberBoxes = ({ values, onChange }: PollaNumberBoxesProps) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    values.forEach((v) => {
      if (v.length === 2) counts.set(v, (counts.get(v) ?? 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([v]) => v));
  }, [values]);

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    const next = [...values];
    next[index] = digits;
    onChange(next);

    if (digits.length === 2 && index < POLLA_NUMBERS_REQUIRED - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Ingresá los 10 números</Label>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {values.map((value, index) => {
          const isDuplicate = value.length === 2 && duplicates.has(value);
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground leading-none">{index + 1}</span>
              <Input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                inputMode="numeric"
                maxLength={2}
                value={value}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={cn(
                  '!w-12 !h-12 sm:!w-14 sm:!h-14 text-center text-xl sm:text-2xl font-bold tabular-nums px-0',
                  isDuplicate && 'border-destructive text-destructive'
                )}
              />
            </div>
          );
        })}
      </div>
      {duplicates.size > 0 && (
        <p className="text-xs text-destructive">Hay números repetidos, deben ser todos distintos</p>
      )}
    </div>
  );
};
