import { useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Printer } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import { useCurrentAccountsOfDay } from '@/hooks/fetchs/usePollaData';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadLiquidationSlipsPDF } from '@/functions/current-account/liquidationSlipPDF';
import { DayBetsTables } from './DayBetsTables';
import { fetchWinnersByCashier } from './fetchers';
import { fmtMoney } from './format';

const FIELDS = [
  ['pass', 'Pase'],
  ['cashier_commission', 'Comisión'],
  ['successes', 'Aciertos'],
  ['claims', 'Reclamos'],
  ['bills', 'Gastos'],
  ['revenue', 'Deja'],
  ['previous_balance', 'Saldo anterior'],
  ['collections', 'Cobro al pasador'],
  ['paid', 'Pago al pasador'],
  ['subtotal', 'Subtotal'],
] as const;

/**
 * La liquidación del pasador para un día, como su vista en QuiniApp: los
 * montos del día, los tickets que cargó, las jugadas que ganaron y el botón
 * para imprimirla.
 */
export const CashierAccountView = () => {
  const { user } = useAuth();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [printing, setPrinting] = useState(false);

  const { data, isFetching } = useCurrentAccountsOfDay({ date });
  const account = data?.data[0];

  const handlePrint = async () => {
    if (!account || !user) return;
    setPrinting(true);
    try {
      const winnersByCashier = await fetchWinnersByCashier({
        date,
        ownAsCashier: { cashierId: user.polla_user_id },
      });
      await downloadLiquidationSlipsPDF({ accounts: [account], winnersByCashier });
    } catch {
      toast.error('No se pudo generar la liquidación');
    } finally {
      setPrinting(false);
    }
  };

  const total = Number(account?.total ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        description="Tu liquidación del día: lo que pasaste, tus aciertos y comisión, y lo que cobraste o te pagaron."
        actions={
          <Button type="button" onClick={handlePrint} disabled={!account || printing}>
            <Printer />
            {printing ? 'Generando…' : 'Imprimir liquidación'}
          </Button>
        }
      />

      <div className="flex flex-col gap-1 sm:w-[200px]">
        <Label htmlFor="cashier-account-date">A la fecha</Label>
        <Input
          id="cashier-account-date"
          type="date"
          value={date}
          max={dayjs().format('YYYY-MM-DD')}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </div>

      {!account ? (
        <EmptyState
          message={isFetching ? 'Cargando…' : 'Todavía no hay liquidación calculada para ese día'}
        />
      ) : (
        <>
          <div className="rounded-xl border bg-card p-4 text-card-foreground">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {account.user_number ? `${account.user_number} · ` : ''}
                {account.user_name} · {dayjs(account.date).format('DD/MM/YYYY')}
              </p>
              {account.is_liquidated ? (
                <Badge variant="success">Liquidado</Badge>
              ) : (
                <Badge variant="outline">Abierto</Badge>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {FIELDS.map(([key, label]) => (
                <div key={key} className="flex justify-between gap-2 border-b pb-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">${fmtMoney(account[key])}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-right text-lg font-bold tabular-nums">
              {total > 0 ? 'Debe' : 'Cobra'}: ${fmtMoney(Math.abs(total))}
            </p>
          </div>

          <DayBetsTables date={account.date} />
        </>
      )}
    </div>
  );
};
