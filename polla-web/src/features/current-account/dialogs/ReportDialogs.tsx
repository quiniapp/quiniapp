import { useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { IPollaGroupEntityFront } from '@helper/polla/types/catalog.type';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  downloadDailyAccountsPDF,
  downloadDailySummaryPDF,
} from '@/functions/current-account/accountTablePDF';
import {
  printDailyTotalsTicket,
  printRangeTotalsTicket,
  printSubtotalsDayTicket,
  printSubtotalsRangeTicket,
} from '@/functions/current-account/totalsTicket';
import {
  fetchAccountsOfDay,
  fetchDailyTotals,
  fetchExpenses,
  fetchOrganizationName,
} from '../fetchers';
import { ALL_GROUPS, ReportMode } from '../format';
import { DateField, ExpensesEditor, GroupSelect, ModeToggle } from './shared';

/** Qué reporte arma el diálogo (los tres comparten filtros). */
export type ReportKind = 'collections' | 'summary' | 'subtotals';

const COPY: Record<ReportKind, { title: string; description: string; action: string }> = {
  collections: {
    title: 'Exportar cobros y pagos',
    description:
      'Ticket con lo que cobraste y pagaste a cada pasador y los gastos del día, o el balance de un período.',
    action: 'Generar ticket',
  },
  summary: {
    title: 'Resumen cuenta corriente',
    description:
      'Planilla de un día (por pasador, si elegís un grupo) o de un período (un renglón por día).',
    action: 'Generar PDF',
  },
  subtotals: {
    title: 'Exportar subtotales',
    description: 'Ticket con el subtotal de cada pasador del día, o de cada día del período.',
    action: 'Generar ticket',
  },
};

interface ReportDialogProps {
  kind: ReportKind;
  initialDate: string;
  initialGroupId: string;
  groups: IPollaGroupEntityFront[];
  organizationId: string | null;
  onClose: () => void;
}

/**
 * Cobros y pagos, Resumen y Subtotales, como los modales de QuiniApp:
 * día o rango, grupo, y (en los tickets) gastos del día y porcentaje del
 * capitalista.
 */
export const ReportDialog = ({
  kind,
  initialDate,
  initialGroupId,
  groups,
  organizationId,
  onClose,
}: ReportDialogProps) => {
  const [mode, setMode] = useState<ReportMode>('day');
  const [date, setDate] = useState(initialDate);
  const [from, setFrom] = useState(dayjs(initialDate).startOf('week').format('YYYY-MM-DD'));
  const [to, setTo] = useState(initialDate);
  const [groupId, setGroupId] = useState(initialGroupId || ALL_GROUPS);
  const [percentage, setPercentage] = useState('50');
  const [printing, setPrinting] = useState(false);

  const effectiveGroupId = groupId === ALL_GROUPS ? null : groupId;
  const groupName = groups.find((g) => g.polla_group_id === effectiveGroupId)?.name;
  const copy = COPY[kind];
  const hasExpenses = kind !== 'summary' && mode === 'day';
  const hasPercentage = kind !== 'summary' && (mode === 'range' || kind === 'subtotals');

  const base = {
    polla_group_id: effectiveGroupId,
    polla_organization_id: organizationId,
  };

  const handlePrint = async () => {
    if (mode === 'range' && from > to) {
      toast.error('La fecha desde tiene que ser anterior a la fecha hasta');
      return;
    }

    try {
      setPrinting(true);
      const orgName = kind === 'summary' ? '' : await fetchOrganizationName(organizationId);

      if (mode === 'day') {
        const rows = await fetchAccountsOfDay({ ...base, date });
        if (!rows.length) {
          toast.error('Sin datos para esa fecha');
          return;
        }

        if (kind === 'summary') {
          await downloadDailyAccountsPDF({
            date,
            rows,
            title: 'Resumen Cuenta Corriente',
            groupName,
          });
        } else {
          const expenses = (await fetchExpenses({ ...base, date })).map((e) => ({
            nombre: e.name,
            monto: Number(e.amount),
          }));
          if (kind === 'collections') {
            await printDailyTotalsTicket({ data: rows, date, orgName, groupName, expenses });
          } else {
            await printSubtotalsDayTicket({
              data: rows,
              date,
              orgName,
              groupName,
              expenses,
              percentage: Number(percentage) || 0,
            });
          }
        }
      } else {
        const totals = await fetchDailyTotals({ ...base, from, to });
        if (!totals.length) {
          toast.error('Sin datos para ese período');
          return;
        }

        if (kind === 'summary') {
          await downloadDailySummaryPDF({ from, to, totals, groupName });
        } else if (kind === 'collections') {
          await printRangeTotalsTicket({
            dailyTotals: totals,
            date_from: from,
            date_to: to,
            percentage: Number(percentage) || 0,
            orgName,
            groupName,
          });
        } else {
          await printSubtotalsRangeTicket({
            dailySummary: totals,
            date_from: from,
            date_to: to,
            orgName,
            groupName,
            percentage: Number(percentage) || 0,
          });
        }
      }

      onClose();
    } catch {
      toast.error('No se pudo generar el reporte');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <ModeToggle value={mode} onChange={setMode} />
          <GroupSelect groups={groups} value={groupId} onChange={setGroupId} />

          {mode === 'day' ? (
            <DateField id="report-date" label="Fecha" value={date} onChange={setDate} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <DateField id="report-from" label="Desde" value={from} onChange={setFrom} />
              <DateField id="report-to" label="Hasta" value={to} onChange={setTo} />
            </div>
          )}

          {hasPercentage && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-percentage">Porcentaje del capitalista</Label>
              <Input
                id="report-percentage"
                inputMode="decimal"
                className="w-28"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </div>
          )}

          {hasExpenses && (
            <ExpensesEditor
              date={date}
              groupId={effectiveGroupId}
              organizationId={organizationId}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handlePrint} disabled={printing}>
            {printing ? 'Generando…' : copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
