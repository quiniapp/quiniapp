export const TextAmount = ({ label, value }: { label: string; value: number | undefined }) => (
  <div className="grid grid-cols-[minmax(0,1fr),auto] items-center gap-x-2">
    {/* una sola línea + ellipsis si no entra */}
    <p className="text-xs md:text-sm lg:text-base truncate whitespace-nowrap min-w-0">{label}</p>

    {/* $ separado + número mono, sin saltos */}
    <span className="text-xs md:text-sm lg:text-base whitespace-nowrap font-mono tabular-nums">
      {value}
    </span>
  </div>
);
