import { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  fetchPaginatedBets,
  type FetchInfiniteBetsProps,
} from '@/hooks/fetchs/plays/useInfiniteBets';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useUsers } from '@/hooks/fetchs/users/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { printGroupedBetsPDF } from '@/functions/printGroupedBetsPDF';
import type { IBetEntityFront } from '@helper/types/bet.type';
import { ALL_PAGES_SIZE, fetchAllPages } from '@/lib/fetchAllPages';

async function fetchAllBets(filters: FetchInfiniteBetsProps): Promise<IBetEntityFront[]> {
  const props = { ...filters, limit: ALL_PAGES_SIZE };

  // Modo lista: keyset, sigue el cursor hasta el final (sin repetidos aunque
  // entren jugadas mientras se imprime).
  if (filters.grouped !== 'true') {
    return fetchAllPages((cursor) => fetchPaginatedBets(props, cursor));
  }

  // Modo agrupado: offset (el agrupado no devuelve count en páginas 2+).
  const bets: IBetEntityFront[] = [];
  for (let page = 1; ; page++) {
    const { data, pagination } = await fetchPaginatedBets(props, page);
    bets.push(...data);
    if (!pagination.hasMore || data.length < ALL_PAGES_SIZE) return bets;
  }
}

const PrintGroupedBetsButton = () => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchParams] = useSearchParams();
  const { role } = useAuth();

  const date = searchParams.get('date');
  const schedule_id = searchParams.get('schedule_id');
  const lottery_id = searchParams.get('lottery_id');
  const cashier_id = searchParams.get('cashier_id');
  const winners = searchParams.get('winners');
  const tern = searchParams.get('tern');
  const quatern = searchParams.get('quatern');
  const isGrouped = searchParams.get('grouped') === 'true';
  const group_id = searchParams.get('group_id');
  const min_amount_param = searchParams.get('min_amount');
  const min_amount = min_amount_param ? Math.max(0, parseFloat(min_amount_param) || 0) : undefined;

  // Mismo fallback que la tabla: sin fecha en la URL se imprime el día de hoy.
  const effectiveDate = date || new Date().toISOString().split('T')[0];

  const { data: lotteries } = useLotteries();
  const { data: schedules } = useSchedules();
  const { data: users } = useUsers(role);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const bets = await fetchAllBets({
        date: effectiveDate,
        schedule_id,
        lottery_id,
        cashier_id,
        grouped: isGrouped ? 'true' : 'false',
        winners,
        tern,
        quatern,
        group_id,
        min_amount,
      });

      if (!bets.length) {
        toast.error('No hay jugadas para imprimir con los filtros seleccionados');
        return;
      }

      const scheduleName = schedules?.find((s) => s.schedule_id === schedule_id)?.name ?? null;
      const lotteryName = lotteries?.find((l) => l.lottery_id === lottery_id)?.name ?? null;
      const cashierName = users?.find((u) => u.user_id === cashier_id)?.name ?? null;

      await printGroupedBetsPDF({
        bets,
        date: effectiveDate,
        scheduleName,
        lotteryName,
        cashierName,
        grouped: isGrouped,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al imprimir las jugadas');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Button
      onClick={handlePrint}
      disabled={isPrinting}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
      Imprimir
    </Button>
  );
};

export default PrintGroupedBetsButton;
