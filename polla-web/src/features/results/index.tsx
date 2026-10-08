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
import { padPollaNumber } from '@/lib/pollaNumbers';
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
const RESULT_DIGITS = 2;
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
  // Cajas que quedaron vacías al apretar Enter o al guardar.
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

  const setNumber = (index: number, value: string) => {
    const next = [...numbers];
    next[index] = value;
    setNumbers(next);
    return next;
  };

  const handleNumberChange = (index: number, raw: string) => {
    const next = setNumber(index, raw.replace(/\D/g, '').slice(0, RESULT_DIGITS));
    if (incomplete.has(index) && next[index]) {
      setIncomplete((prev) => {
        const rest = new Set(prev);
        rest.delete(index);
        return rest;
      });
    }
  };

  // Como en QuiniApp: Guardar se habilita recién con los 20 números cargados
  // (una cifra sola vale: se completa con cero al guardar).
  const filledCount = numbers.filter((value) => /^\d{1,2}$/.test(value)).length;
  const isComplete = filledCount === RESULTS_COUNT;
  const isSaving = isCreating || isUpdating;
  const canSave = isComplete && Boolean(lotteryId && scheduleId) && !isSaving;

  const handleSave = (values: string[] = numbers) => {
    const results = values.map(padPollaNumber);
    const parsed = newPollaResultSchema.safeParse({
      polla_lottery_id: lotteryId,
      polla_schedule_id: scheduleId,
      date,
      results,
      ...(organizationId ? { polla_organization_id: organizationId } : {}),
    });

    if (!parsed.success) {
      const missing = results
        .map((value, index) => (value.length === RESULT_DIGITS ? -1 : index))
        .filter((index) => index >= 0);
      setIncomplete(new Set(missing));
      inputRefs.current[missing[0]]?.focus();
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los resultados');
      return;
    }

    // Guardar no calcula nada: los aciertos salen de "Generar ganadores".
    const afterSave = {
      onSuccess: () =>
        toast('Para calcular los aciertos del día tocá Generar ganadores', { duration: 6000 }),
    };

    if (existing) {
      updateResult({ id: existing.polla_result_id, results: parsed.data.results }, afterSave);
      return;
    }

    createResult(parsed.data, afterSave);
  };

  // Como en QuiniApp: Enter pasa siempre a la caja siguiente (una cifra se
  // completa con cero: 7 queda 07). En la última guarda si están los 20; si
  // falta alguno, vuelve a la primera vacía.
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const next = setNumber(index, padPollaNumber(numbers[index]));

    if (index < RESULTS_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
      return;
    }

    const missing = next.map((value, i) => (value ? -1 : i)).filter((i) => i >= 0);
    if (missing.length) {
      setIncomplete(new Set(missing));
      inputRefs.current[missing[0]]?.focus();
      return;
    }

    if (lotteryId && scheduleId && !isSaving) handleSave(next);
  };

  const handleBlur = (index: number) => {
    const padded = padPollaNumber(numbers[index]);
    if (padded !== numbers[index]) setNumber(index, padded);
  };

  const handleGenerateWinners = () => {
    if (!scheduleId) {
      toast.error('Elegí el turno para generar los ganadores');
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
              'La corrección anuló al ganador y la edición sigue en juego: generá los ganadores de los días siguientes que ya tengan resultado.',
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

  return (
    <div>
      <PageHeader
        description={
          canManage
            ? 'Cargá o corregí los 20 números del día (2 cifras cada uno). Los aciertos se calculan al tocar Generar ganadores.'
            : 'Los 20 números de cada sorteo, de 2 cifras.'
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
              <Button
                type="button"
                onClick={() => handleSave()}
                disabled={!canSave}
                title={
                  !lotteryId || !scheduleId
                    ? 'Elegí quiniela y turno'
                    : !isComplete
                      ? 'Faltan resultados por cargar'
                      : undefined
                }
              >
                {isSaving ? 'Guardando…' : existing ? 'Guardar corrección' : 'Guardar resultados'}
              </Button>
              <Button
                type="button"
                variant="success"
                onClick={handleGenerateWinners}
                disabled={isProcessing}
              >
                {isProcessing ? 'Generando…' : 'Generar ganadores'}
              </Button>
            </div>
          </div>

          {existing && (
            <p className="text-xs text-muted-foreground">
              Este día ya tiene resultado cargado: podés editarlo y guardar la corrección. Después
              tocá Generar ganadores; solo se recalculan los aciertos de este día.
            </p>
          )}

          <div className="grid w-fit grid-cols-2 gap-x-6 gap-y-1.5 sm:gap-x-10">
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
                      onBlur={() => handleBlur(index)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={cn(
                        'h-10 w-16 text-center font-mono text-lg font-bold tabular-nums',
                        incomplete.has(index) && 'border-2 border-destructive'
                      )}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p
            className={cn(
              'text-sm',
              incomplete.size > 0 && !isComplete ? 'text-destructive' : 'text-muted-foreground'
            )}
            role="status"
          >
            {isComplete
              ? 'Los 20 resultados están cargados.'
              : `Cargados ${filledCount} de ${RESULTS_COUNT}. Guardar se habilita con los 20 (2 cifras cada uno).`}
          </p>
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
