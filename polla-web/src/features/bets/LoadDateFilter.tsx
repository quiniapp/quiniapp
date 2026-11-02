import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { oldestRangeFrom } from '@/lib/accountPeriod';
import { todayIso } from '@/lib/dates';

/** Días de carga (`load_from`/`load_to`): van los dos; un solo día es desde = hasta. */
export interface LoadRange {
  from: string;
  to: string;
}

/** Lo que acepta la API: desde ≤ hasta y hasta `POLLA_ACCOUNT_RECALC_MAX_DAYS` días. */
const isValidRange = (from: string, to: string) => from <= to && from >= oldestRangeFrom(to);

interface LoadDateFilterProps {
  /** `null`: cualquier día de carga. */
  value: LoadRange | null;
  onChange: (value: LoadRange | null) => void;
}

/**
 * Filtro por día de carga. Elegir un extremo con el otro vacío filtra ese día;
 * si el otro queda fuera de rango (desde después de hasta, o más días de los
 * que acepta la API), se corre al mismo día. La cruz vuelve a todos los días.
 */
export const LoadDateFilter = ({ value, onChange }: LoadDateFilterProps) => {
  const today = todayIso();

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor="bets-load-from">Cargadas desde</Label>
        <DateInput
          id="bets-load-from"
          value={value?.from ?? ''}
          max={today}
          onValueChange={(from) =>
            onChange({ from, to: value && isValidRange(from, value.to) ? value.to : from })
          }
          className="sm:w-[160px]"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor="bets-load-to">Hasta</Label>
        <div className="flex items-center gap-1">
          <DateInput
            id="bets-load-to"
            value={value?.to ?? ''}
            max={today}
            onValueChange={(to) =>
              onChange({ from: value && isValidRange(value.from, to) ? value.from : to, to })
            }
            className="sm:w-[160px]"
          />
          {value && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              title="Todos los días"
              aria-label="Quitar el filtro de fechas"
              onClick={() => onChange(null)}
            >
              <X />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
