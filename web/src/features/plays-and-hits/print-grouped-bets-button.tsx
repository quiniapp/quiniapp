import { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBets } from '@/hooks/fetchs/plays/useBets';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { useUsers } from '@/hooks/fetchs/users/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { printGroupedBetsPDF } from '@/functions/printGroupedBetsPDF';

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

  const { data: bets } = useBets({
    date,
    schedule_id,
    lottery_id,
    cashier_id,
    grouped: 'true',
    winners,
    tern,
    quatern,
  });

  const { data: lotteries } = useLotteries();
  const { data: schedules } = useSchedules();
  const { data: users } = useUsers(role);

  const handlePrint = async () => {
    if (!bets?.length) return;
    setIsPrinting(true);
    try {
      const scheduleName = schedules?.find((s) => s.schedule_id === schedule_id)?.name ?? null;
      const lotteryName = lotteries?.find((l) => l.lottery_id === lottery_id)?.name ?? null;
      const cashierName = users?.find((u) => u.user_id === cashier_id)?.name ?? null;

      await printGroupedBetsPDF({ bets, date, scheduleName, lotteryName, cashierName });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Button
      onClick={handlePrint}
      disabled={!isGrouped || isPrinting}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isPrinting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Printer className="w-4 h-4" />
      )}
      Imprimir
    </Button>
  );
};

export default PrintGroupedBetsButton;
