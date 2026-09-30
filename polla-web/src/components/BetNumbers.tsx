import { cn } from '@/lib/utils';

interface BetNumbersProps {
  numbers: string[];
  hitNumbers: string[];
}

/** Los 10 números, con los acertados resaltados uno por uno. */
export const BetNumbers = ({ numbers, hitNumbers }: BetNumbersProps) => {
  const hits = new Set(hitNumbers);

  return (
    <div className="flex flex-wrap gap-1">
      {numbers.map((number, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={`${number}-${index}`}
          className={cn(
            'inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded px-1 font-mono text-xs tabular-nums',
            hits.has(number)
              ? 'bg-emerald-600 font-bold text-white'
              : 'bg-primary/10 text-foreground'
          )}
        >
          {number}
        </span>
      ))}
    </div>
  );
};
