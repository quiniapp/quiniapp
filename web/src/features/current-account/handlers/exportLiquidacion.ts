import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { printUserSlipPDF } from '@/functions/printLiquidationCashier';
import { fetchCurrentAccountData, fetchWinningBetsForAccount } from './shared';

export async function exportLiquidacion(
  queryClient: QueryClient,
  date: string | null,
  setPrinting: (v: boolean) => void
) {
  try {
    setPrinting(true);
    const accounts = await fetchCurrentAccountData(queryClient, date);
    if (!accounts?.length) {
      toast.error('No hay cuentas a liquidar.');
      return;
    }
    for (const acc of accounts) {
      const bets = await fetchWinningBetsForAccount(queryClient, acc);
      await printUserSlipPDF({ account: acc, date: acc.date, bets });
    }
    toast.success('Liquidaciones exportadas.');
  } catch (e) {
    console.error(e);
    toast.error('Error exportando liquidaciones.');
  } finally {
    setPrinting(false);
  }
}
