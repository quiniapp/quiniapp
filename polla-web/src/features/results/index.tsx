import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';
import { newPollaResultSchema } from '@helper/polla/schemas/game.schema';
import { IPollaResultEntityFront } from '@helper/polla/types/game.type';
import { isPollaAdminRole } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useResultFor, useResults } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateResult,
  useDeleteResult,
  useProcessResults,
  useUpdateResult,
} from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { flattenPages } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const fmtDate = (value: string) => dayjs(value).format('DD-MM-YYYY');
const RESULTS_COUNT = 20;
const RESULT_DIGITS = 4;
const emptyResults = () => Array<string>(RESULTS_COUNT).fill('');
/** Como en la quiniela: 1 a 10 en la primera columna y 11 a 20 en la segunda. */
const COLUMNS = [
  Array.from({ length: 10 }, (_, i) => i),
  Array.from({ length: 10 }, (_, i) => i + 10),
];

export const ResultsPage = () => {
  const { role, organizationId } = useAuth();
  const today = dayjs().format('YYYY-MM-DD');

  // Todos ven los resultados; solo ADMIN+ los carga, corrige y procesa.
  const canManage = Boolean(role && isPollaAdminRole(role));

  const [date, setDate] = useState(today);
  const [lotteryId, setLotteryId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [numbers, setNumbers] = useState<string[]>(emptyResults);
  // Cajas en las que se apretó Enter sin las 4 cifras.
  const [incomplete, setIncomplete] = useState<Set<number>>(new Set());
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useResults({
    polla_organization_id: organizationId ?? undefined,
  });

  const { rows, totalCount } = flattenPages(data?.pages);
  const { data: lotteries } = useLotteries({ polla_organization_id: organizationId ?? undefined });
  const { data: schedules } = useSchedules({ polla_organization_id: organizationId ?? undefined });

  // Si el día ya tiene resultado, se trae para corregirlo en vez de duplicarlo.
  const { data: existingPage } = useResultFor(
    {
      date,
      polla_lottery_id: lotteryId,
      polla_schedule_id: scheduleId,
      polla_organization_id: organizationId ?? undefined,
    },
    canManage && Boolean(date && lotteryId && scheduleId)
  );
  const existing = lotteryId && scheduleId ? existingPage?.data[0] : undefined;

  useEffect(() => {
    setNumbers(existing ? [...existing.results] : emptyResults());
    setIncomplete(new Set());
  }, [existing?.polla_result_id, existing?.edited_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate: createResult, isPending: isCreating } = useCreateResult();
  const { mutate: updateResult, isPending: isUpdating } = useUpdateResult();
  const { mutate: deleteResult } = useDeleteResult();
  const { mutate: processResults, isPending: isProcessing } = useProcessResults();

  const lotteryById = useMemo(
    () => new Map(lotteries?.data.map((l) => [l.polla_lottery_id, l.name])),
    [lotteries]
  );
  const scheduleById = useMemo(
    () => new Map(schedules?.data.map((s) => [s.polla_schedule_id, s.name])),
    [schedules]
  );

  const handleNumberChange = (index: number, raw: string) => {
    const next = [...numbers];
    next[index] = raw.replace(/\D/g, '').slice(0, RESULT_DIGITS);
    setNumbers(next);
    if (incomplete.has(index) && next[index].length === RESULT_DIGITS) {
      setIncomplete((prev) => {
        const rest = new Set(prev);
        rest.delete(index);
        return rest;
      });
    }
  };

  const handleSave = () => {
    const parsed = newPollaResultSchema.safeParse({
      polla_lottery_id: lotteryId,
      polla_schedule_id: scheduleId,
      date,
      results: numbers,
      ...(organizationId ? { polla_organization_id: organizationId } : {}),
    });

    if (!parsed.success) {
      const missing = numbers
        .map((value, index) => (value.length === RESULT_DIGITS ? -1 : index))
        .filter((index) => index >= 0);
      setIncomplete(new Set(missing));
      inputRefs.current[missing[0]]?.focus();
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los resultados');
      return;
    }

    if (existing) {
      updateResult(
        { id: existing.polla_result_id, results: parsed.data.results },
        {
          onSuccess: () =>
            toast('Si ya procesaste este día, volvé a procesar los aciertos', { duration: 6000 }),
        }
      );
      return;
    }

    createResult(parsed.data);
  };

  // Como en la quiniela: se escriben las 4 cifras (0088 incluido) y Enter pasa
  // al siguiente; en el último guarda. Con menos de 4 cifras no avanza.
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (numbers[index].length !== RESULT_DIGITS) {
      setIncomplete((prev) => new Set(prev).add(index));
      return;
    }

    if (index < RESULTS_COUNT - 1) inputRefs.current[index + 1]?.focus();
    else handleSave();
  };

  const handleProcess = () => {
    if (!scheduleId) {
      toast.error('Elegí un turno para procesar');
      return;
    }
    processResults(
      {
        polla_schedule_id: scheduleId,
        date,
        ...(organizationId ? { polla_organization_id: organizationId } : {}),
      },
      {
        onSuccess: (result) => {
          // La corrección revirtió un ganador: los días posteriores que ya
          // estaban cargados quedaron sin procesar para esa edición.
          if (result.editions.some((edition) => edition.reopened)) {
            toast(
              'La corrección anuló al ganador y la edición sigue en juego: procesá los días siguientes que ya tengan resultado.',
              { duration: 10000 }
            );
          }
        },
      }
    );
  };

  const handleEdit = (result: IPollaResultEntityFront) => {
    setDate(result.date);
    setLotteryId(result.polla_lottery_id);
    setScheduleId(result.polla_schedule_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSaving = isCreating || isUpdating;

  return (
    <div>
      <PageHeader
        description={
          canManage
            ? 'Cargá o corregí los 20 números del día y procesá los aciertos de las ediciones en juego.'
            : 'Los 20 números de cada sorteo. En la Polla cuentan las 2 últimas cifras.'
        }
      />

      {canManage && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl bg-card p-3 text-card-foreground sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-0 flex-col gap-1">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label>Quiniela</Label>
              <Select value={lotteryId} onValueChange={setLotteryId}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Elegí" />
                </SelectTrigger>
                <SelectContent>
                  {lotteries?.data.map((l) => (
                    <SelectItem key={l.polla_lottery_id} value={l.polla_lottery_id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label>Turno</Label>
              <Select value={scheduleId} onValueChange={setScheduleId}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Elegí" />
                </SelectTrigger>
                <SelectContent>
                  {schedules?.data.map((s) => (
                    <SelectItem key={s.polla_schedule_id} value={s.polla_schedule_id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Guardando…' : existing ? 'Guardar corrección' : 'Guardar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleProcess}
                disabled={isProcessing}
              >
                {isProcessing ? 'Procesando…' : 'Procesar aciertos'}
              </Button>
            </div>
          </div>

          {existing && (
            <p className="text-xs text-muted-foreground">
              Este día ya tiene resultado cargado: al guardar se corrige. Después procesá los
              aciertos del día; solo se recalculan los de este día.
            </p>
          )}

          <div className="grid max-w-md grid-cols-2 gap-x-4 gap-y-1.5 sm:gap-x-8">
            {COLUMNS.map((column, columnIndex) => (
              <div key={columnIndex} className="flex flex-col gap-1.5">
                {column.map((index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-6 text-right text-sm font-bold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <Input
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      inputMode="numeric"
                      enterKeyHint={index < RESULTS_COUNT - 1 ? 'next' : 'done'}
                      maxLength={RESULT_DIGITS}
                      value={numbers[index]}
                      aria-label={`Resultado ${index + 1}`}
                      aria-invalid={incomplete.has(index)}
                      onChange={(e) => handleNumberChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={cn(
                        'h-10 text-center font-mono text-lg font-bold tabular-nums',
                        incomplete.has(index) && 'border-2 border-destructive'
                      )}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {incomplete.size > 0 && (
            <p className="text-sm text-destructive" role="alert">
              Cada resultado lleva 4 cifras (por ejemplo 0088).
            </p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState message="Todavía no hay resultados cargados" />
      ) : (
        <InfiniteList
          totalCount={totalCount}
          loadedCount={rows.length}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        >
          <div className="rounded-md border bg-card text-card-foreground">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Quiniela / Turno</TableHead>
                  <TableHead>Resultados</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((result) => (
                  <TableRow key={result.polla_result_id}>
                    <TableCell>{fmtDate(result.date)}</TableCell>
                    <TableCell>
                      {lotteryById.get(result.polla_lottery_id) ?? '-'} ·{' '}
                      {scheduleById.get(result.polla_schedule_id) ?? '-'}
                    </TableCell>
                    <TableCell className="whitespace-normal font-mono text-xs">
                      {result.results.join(' · ')}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Corregir"
                          onClick={() => handleEdit(result)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Eliminar"
                          onClick={() => {
                            if (window.confirm('¿Eliminar los resultados de ese día?')) {
                              deleteResult({ id: result.polla_result_id });
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </InfiniteList>
      )}
    </div>
  );
};

export default ResultsPage;
