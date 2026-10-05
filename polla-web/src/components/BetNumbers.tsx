import { betNumberClass, hitTitle } from '@/lib/betNumbers';
import { cn } from '@/lib/utils';

interface BetNumbersProps {
  numbers: string[];
  /** En paralelo a `numbers`: fecha del acierto de cada casillero o null. */
  hitDates?: (string | null)[];
}

/**
 * Los 10 números con la marca de acierto por casillero: si el 32 se jugó 5
 * veces y salió 2, se marcan 2 de los 5.
 */
export const BetNumbers = ({ numbers, hitDates }: BetNumbersProps) => (
  <div className="flex flex-wrap gap-1">
    {numbers.map((number, index) => {
      const hitDate = hitDates?.[index] ?? null;
      return (
        <span
          key={index}
          title={hitTitle(hitDate)}
          className={cn(
            'inline-flex h-7 min-w-[2rem] items-center justify-center rounded border px-1 font-mono text-sm tabular-nums',
            betNumberClass(Boolean(hitDate))
          )}
        >
          {number}
        </span>
      );
    })}
  </div>
);
