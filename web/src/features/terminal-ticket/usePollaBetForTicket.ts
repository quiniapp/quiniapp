import { useMemo } from 'react';
import { usePollaBets } from '@/hooks/fetchs/polla-bet/usePollaBets';
import { usePollaEditions } from '@/hooks/fetchs/polla-edition/usePollaEditions';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';

// Resuelve la jugada de Polla asociada a un ticket (si la hay) junto con el
// nombre de quiniela/turno de su edición, para mostrarla en "Revisar Jugada"
// igual que se muestra cualquier otra jugada (ej. Borratina).
export const usePollaBetForTicket = (ticket_number?: string | null) => {
  const { data: bets } = usePollaBets({
    ticket_number: ticket_number ?? undefined,
    enabled: !!ticket_number,
  });
  const { data: editions } = usePollaEditions();
  const { data: lotteries } = useLotteries({ all: true });
  const { data: schedules } = useSchedules({ all: true });

  const bet = bets?.[0];

  const edition = useMemo(
    () => editions?.find((e) => e.polla_edition_id === bet?.polla_edition_id),
    [editions, bet]
  );

  const lotteryName = useMemo(
    () => lotteries?.find((l) => l.lottery_id === edition?.lottery_id)?.name,
    [lotteries, edition]
  );

  const scheduleName = useMemo(
    () => schedules?.find((s) => s.schedule_id === edition?.schedule_id)?.name,
    [schedules, edition]
  );

  return { bet, ticketAmount: edition?.ticket_price, lotteryName, scheduleName };
};
