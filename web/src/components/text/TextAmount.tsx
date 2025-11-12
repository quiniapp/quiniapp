// Fuera del componente (evita recrear el formatter en cada render)
const INTL_INT_AR = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export const TextAmount = ({ label, value }: { label: string; value: number | undefined }) => {
  const isFiniteNumber = typeof value === 'number' && Number.isFinite(value);
  const n = isFiniteNumber ? value! : null;

  const isNeg = n !== null && n < 0;
  const abs = n !== null ? Math.abs(n) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr),auto] items-center gap-x-2">
      {/* una sola línea + ellipsis si no entra */}
      <p className="text-xs md:text-sm lg:text-base truncate whitespace-nowrap min-w-0">
        {label}
      </p>

      {/* $ separado + número mono, sin saltos */}
      <span className="text-xs md:text-sm lg:text-base whitespace-nowrap font-mono tabular-nums">
        {n === null ? (
          '--'
        ) : (
          <>
            {isNeg && <span aria-hidden>−</span>}
            <span aria-hidden>$</span>
            <span>{INTL_INT_AR.format(abs!)}</span>
          </>
        )}
      </span>
    </div>
  );
};
