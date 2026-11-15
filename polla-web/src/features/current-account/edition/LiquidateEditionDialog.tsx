import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  IPollaEditionAccountListItem,
  IPollaEditionAccountRow,
  IPollaEditionLiquidationDifference,
  IPollaEditionLiquidationEntity,
  IPollaEditionLiquidationResult,
} from '@helper/polla/types/game.type';
import { useEditionAccounts } from '@/hooks/fetchs/usePollaData';
import { useLiquidateEditionAccounts } from '@/hooks/mutations/usePollaMutations';
import { downloadLiquidationSlipsPDF } from '@/functions/current-account/liquidationSlipPDF';
import { editionAccountView, editionFileTag, hasEditionMovement } from '@/lib/editionAccount';
import { groupLabel } from '@/lib/pollaGroups';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CashierPickDialog } from '../dialogs/ExportLiquidationsDialog';
import { fmtMoney } from '../format';
import { useCashierCode } from './useCashierCode';

/** La fila con los montos congelados en la liquidación (lo que lleva la hoja del pasador). */
const withLiquidation = (
  row: IPollaEditionAccountRow,
  liquidation: IPollaEditionLiquidationEntity
): IPollaEditionAccountRow => ({
  ...row,
  bets_pass: liquidation.bets_pass,
  deleted_pass: liquidation.deleted_pass,
  claims: liquidation.claims,
  pass: liquidation.pass,
  cashier_commission: liquidation.cashier_commission,
  subtotal: liquidation.subtotal,
  revenue: liquidation.subtotal,
  collections: liquidation.collections,
  paid: liquidation.paid,
  total: liquidation.total,
});

/**
 * "Liquidar": elegir pasadores, liquidar y bajar las hojas. Si las jugadas
 * cambiaron desde una liquidación anterior, avisa las diferencias y deja
 * elegir con cuáles seguir.
 */
export const LiquidateEditionDialog = ({
  item,
  title,
  onClose,
}: {
  item: IPollaEditionAccountListItem;
  /** Título de la edición (cabecera y nombre de las hojas). */
  title: string;
  onClose: () => void;
}) => {
  const { edition } = item;
  const { data: rows } = useEditionAccounts(edition.polla_edition_id);
  const { groups, cashierCode } = useCashierCode();
  const { mutateAsync: liquidate, isPending } = useLiquidateEditionAccounts();

  const [chosen, setChosen] = useState<IPollaEditionAccountRow[]>([]);
  const [differences, setDifferences] = useState<IPollaEditionLiquidationDifference[] | null>(null);
  const [exporting, setExporting] = useState(false);

  const busy = isPending || exporting;
  const codeOf = (row: { polla_group_id: string | null; user_number: number | null }) => {
    const code = cashierCode(row);
    return code ? `${code} · ` : '';
  };

  const run = async (selected: IPollaEditionAccountRow[], source?: 'NEW' | 'OLD') => {
    let result: IPollaEditionLiquidationResult;
    try {
      result = await liquidate({
        editionId: edition.polla_edition_id,
        polla_user_ids: selected.map((row) => row.polla_user_id),
        ticket_source: source,
      });
    } catch {
      // `useApiMutation` ya mostró el error de la liquidación.
      return;
    }

    if (result.status === 'DIFFERENCES') {
      setChosen(selected);
      setDifferences(result.differences);
      return;
    }

    // Ya se liquidó: cualquier falla de acá en adelante es solo de las hojas.
    setExporting(true);
    try {
      const byUser = new Map(selected.map((row) => [row.polla_user_id, row]));
      const accounts = result.liquidations.flatMap((liquidation) => {
        const row = byUser.get(liquidation.polla_user_id);
        return row ? [editionAccountView(withLiquidation(row, liquidation), edition)] : [];
      });

      if (accounts.length > 0) {
        await downloadLiquidationSlipsPDF({
          accounts,
          cashierCodeOf: cashierCode,
          headerLabel: title,
          fileTag: editionFileTag(title),
        });
      }
      toast.success('Cuentas liquidadas');
    } catch (error) {
      console.error(error);
      toast.error('Se liquidó, pero no se pudieron generar las hojas');
    } finally {
      setExporting(false);
    }
    onClose();
  };

  if (differences) {
    return (
      <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
        <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Cambió desde la última liquidación</DialogTitle>
            <DialogDescription>
              Las jugadas de estos pasadores no son las de su liquidación anterior. Elegí con cuáles
              seguir.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pasador</TableHead>
                  <TableHead className="text-right">Pase viejo</TableHead>
                  <TableHead className="text-right">Pase nuevo</TableHead>
                  <TableHead className="text-right">Borradas viejas</TableHead>
                  <TableHead className="text-right">Borradas nuevas</TableHead>
                  <TableHead className="text-right">Debe viejo</TableHead>
                  <TableHead className="text-right">Debe nuevo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {differences.map((difference) => (
                  <TableRow key={difference.polla_user_id}>
                    <TableCell className="whitespace-nowrap">
                      {codeOf(difference)}
                      {difference.user_name}
                    </TableCell>
                    {(
                      [
                        difference.old.bets_pass,
                        difference.new.bets_pass,
                        difference.old.deleted_pass,
                        difference.new.deleted_pass,
                        difference.old.total,
                        difference.new.total,
                      ] as const
                    ).map((value, index) => (
                      <TableCell key={index} className="text-right tabular-nums">
                        ${fmtMoney(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => run(chosen, 'OLD')}
            >
              Continuar con el viejo
            </Button>
            <Button type="button" disabled={busy} onClick={() => run(chosen, 'NEW')}>
              Continuar con el nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!rows) {
    return (
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Liquidar</DialogTitle>
            <DialogDescription>Cargando pasadores…</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <CashierPickDialog
      title="Liquidar"
      description="Se liquida a los pasadores elegidos y se descarga la hoja de cada uno. Los que no tienen movimiento en la edición vienen sin tildar."
      items={rows}
      idOf={(row) => row.polla_user_id}
      labelOf={(row) => `${codeOf(row)}${row.user_name}`}
      totalOf={(row) => row.total}
      hasMovement={hasEditionMovement}
      groups={groups.map((group) => ({ value: group.polla_group_id, label: groupLabel(group) }))}
      groupIdOf={(row) => row.polla_group_id}
      actionLabel={(count) => `Liquidar ${count} ${count === 1 ? 'pasador' : 'pasadores'}`}
      busyLabel="Liquidando…"
      busy={busy}
      onConfirm={(selected) => run(selected)}
      onClose={onClose}
    />
  );
};
