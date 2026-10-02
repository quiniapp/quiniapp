import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { newPollaResultSchema } from '@helper/polla/schemas/game.schema';
import { useAuth } from '@/providers/AuthContext';
import { useResults } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import {
  useCreateResult,
  useDeleteResult,
  useProcessResults,
} from '@/hooks/mutations/usePollaMutations';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { InfiniteList } from '@/components/InfiniteList';
import { flattenPages } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
const EMPTY_RESULTS = Array(20).fill('');

export const ResultsPage = () => {
  const { organizationId } = useAuth();
  const today = dayjs().format('YYYY-MM-DD');

  const [date, setDate] = useState(today);
  const [lotteryId, setLotteryId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [numbers, setNumbers] = useState<string[]>(EMPTY_RESULTS);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useResults({
    polla_organization_id: organizationId ?? undefined,
  });

  const { rows, totalCount } = flattenPages(data?.pages);
  const { data: lotteries } = useLotteries({ polla_organization_id: organizationId ?? undefined });
  const { data: schedules } = useSchedules({ polla_organization_id: organizationId ?? undefined });

  const { mutate: createResult, isPending } = useCreateResult();
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
    next[index] = raw.replace(/\D/g, '').slice(0, 4);
    setNumbers(next);
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
      toast.error(parsed.error.errors[0]?.message ?? 'Revisá los resultados');
      return;
    }

    createResult(parsed.data, { onSuccess: () => setNumbers(EMPTY_RESULTS) });
  };

  const handleProcess = () => {
    if (!scheduleId) {
      toast.error('Elegí un turno para procesar');
      return;
    }
    processResults({
      polla_schedule_id: scheduleId,
      date,
      ...(organizationId ? { polla_organization_id: organizationId } : {}),
    });
  };

  return (
    <div>
      <PageHeader description="Cargá los 20 números del día y procesá los aciertos de las ediciones en juego." />

      <div className="mb-6 flex flex-col gap-4 rounded-xl bg-card p-3 sm:p-4">
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
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="outline" onClick={handleProcess} disabled={isProcessing}>
              {isProcessing ? 'Procesando…' : 'Procesar aciertos'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
          {numbers.map((value, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="flex flex-col items-center gap-1">
              <span className="text-[10px] leading-none text-muted-foreground">{index + 1}</span>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={value}
                onChange={(e) => handleNumberChange(index, e.target.value)}
                className="text-center font-mono tabular-nums"
              />
            </div>
          ))}
        </div>
      </div>

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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Quiniela / Turno</TableHead>
                  <TableHead>Resultados</TableHead>
                  <TableHead />
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
                    <TableCell className="font-mono text-xs">
                      {result.results.join(' · ')}
                    </TableCell>
                    <TableCell className="text-right">
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
