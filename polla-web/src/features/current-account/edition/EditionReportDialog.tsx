import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { IPollaGroupEntityFront } from '@helper/polla/types/catalog.type';
import {
  IPollaEditionAccountListItem,
  IPollaEditionAccountRow,
  pollaEditionTitle,
} from '@helper/polla/types/game.type';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import { useEditionAccountList } from '@/hooks/fetchs/usePollaData';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { downloadLiquidationSlipsPDF } from '@/functions/current-account/liquidationSlipPDF';
import {
  printDailyTotalsTicket,
  printRangeTotalsTicket,
  printSubtotalsDayTicket,
  printSubtotalsRangeTicket,
} from '@/functions/current-account/totalsTicket';
import {
  editionAccountView,
  editionFileTag,
  editionsInRange,
  hasEditionMovement,
} from '@/lib/editionAccount';
import { todayIso } from '@/lib/dates';
import {
  fetchEditionAccounts,
  fetchEditionTotals,
  fetchExpenses,
  fetchOrganizationName,
} from '../fetchers';
import { ALL_GROUPS } from '../format';
import { CashierPickDialog } from '../dialogs/ExportLiquidationsDialog';
import { DateField, GroupSelect, ModeToggle } from '../dialogs/shared';
import { EditionExpensesEditor } from './EditionExpensesEditor';
import { useCashierCode } from './useCashierCode';

/** Qué reporte arma el diálogo. `liquidation` es "Exportar liquidación" (hojas por pasador). */
export type EditionReportKind = 'daily' | 'collections' | 'summary' | 'subtotals' | 'liquidation';

type Scope = 'one' | 'many';

/** Tope de ediciones por pedido de totales (el de la API). */
const MAX_EDITIONS = 60;

const COPY: Record<EditionReportKind, { title: string; description: string; action: string }> = {
  daily: {
    title: 'Exportar diario',
    description: 'Planilla con la cuenta de cada pasador en la edición, o un renglón por edición.',
    action: 'Generar PDF',
  },
  liquidation: {
    title: 'Exportar liquidación',
    description:
      'Una hoja por pasador. Con varias ediciones se descargan las hojas de los pasadores con movimiento de cada una.',
    action: 'Exportar',
  },
  collections: {
    title: 'Exportar cobros y pagos',
    description: 'Ticket con lo que cobraste y pagaste a cada pasador y los gastos de la edición.',
    action: 'Generar ticket',
  },
  summary: {
    title: 'Resumen cuenta corriente',
    description:
      'Planilla de la edición (por pasador, si elegís un grupo) o un renglón por cada edición elegida.',
    action: 'Generar PDF',
  },
  subtotals: {
    title: 'Exportar subtotales',
    description:
      'Ticket con el subtotal de cada pasador en la edición, o de cada edición elegida, con el % del capitalista.',
    action: 'Generar ticket',
  },
};

const SCOPE_OPTIONS = [
  ['one', 'Una edición'],
  ['many', 'Varias ediciones'],
] as const;

interface EditionReportDialogProps {
  kind: EditionReportKind;
  /** La edición abierta en el detalle. */
  edition: IPollaEditionAccountListItem;
  /** Su título (`pollaEditionTitle`): encabezado y nombre de los archivos. */
  title: string;
  groups: IPollaGroupEntityFront[];
  organizationId: string | null;
  onClose: () => void;
}

/**
 * Los reportes de la cuenta corriente por edición. "Una edición" usa la
 * abierta en el detalle; "Varias ediciones" lista con casillas las que
 * empiezan entre Desde y Hasta y arma un renglón por edición.
 */
export const EditionReportDialog = ({
  kind,
  edition: item,
  title,
  groups,
  organizationId,
  onClose,
}: EditionReportDialogProps) => {
  const { edition } = item;
  const { cashierCode } = useCashierCode();
  const catalogs = useDrawCatalogs(organizationId);
  const { data: list } = useEditionAccountList({
    polla_organization_id: organizationId ?? undefined,
  });

  const today = todayIso();
  const [scope, setScope] = useState<Scope>('one');
  const [from, setFrom] = useState(() => {
    const monthStart = dayjs(edition.start_date).startOf('month').format('YYYY-MM-DD');
    return monthStart < today ? monthStart : today;
  });
  const [to, setTo] = useState(today);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [groupId, setGroupId] = useState(ALL_GROUPS);
  const [percentage, setPercentage] = useState('50');
  const [printing, setPrinting] = useState(false);
  const [picking, setPicking] = useState<IPollaEditionAccountRow[] | null>(null);

  const effectiveGroupId = groupId === ALL_GROUPS ? null : groupId;
  const groupName = groups.find((g) => g.polla_group_id === effectiveGroupId)?.name;
  const copy = COPY[kind];
  const many = scope === 'many';
  const editionId = edition.polla_edition_id;
  const hasExpenses = !many && (kind === 'collections' || kind === 'subtotals');
  const hasPercentage = (kind === 'collections' && many) || kind === 'subtotals';
  const hasGroup = kind !== 'liquidation' && groups.length > 0;

  const inRange = useMemo(() => editionsInRange(list ?? [], from, to), [list, from, to]);
  const checked = inRange.filter((entry) => !unchecked.has(entry.edition.polla_edition_id));
  const toggle = (id: string, on: boolean) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });

  const titleOf = (entry: IPollaEditionAccountListItem) =>
    pollaEditionTitle(entry.edition, catalogs);

  /** Hojas de los pasadores con movimiento de cada edición tildada, sin pedir la lista. */
  const exportManySlips = async () => {
    let downloaded = 0;
    for (const entry of checked) {
      const entryTitle = titleOf(entry);
      const rows = (await fetchEditionAccounts(entry.edition.polla_edition_id)).filter(
        hasEditionMovement
      );
      if (rows.length === 0) continue;
      await downloadLiquidationSlipsPDF({
        accounts: rows.map((row) => editionAccountView(row, entry.edition)),
        cashierCodeOf: cashierCode,
        headerLabel: entryTitle,
        fileTag: editionFileTag(entryTitle),
      });
      downloaded += rows.length;
    }
    if (downloaded === 0) {
      toast.error('Ninguna edición tiene pasadores con movimiento');
      return false;
    }
    return true;
  };

  const printOne = async () => {
    const accounts = await fetchEditionAccounts(editionId, { polla_group_id: effectiveGroupId });
    if (!accounts.length) {
      toast.error('Sin datos para esa edición');
      return false;
    }
    if (kind === 'liquidation') {
      setPicking(accounts);
      return false;
    }

    const views = accounts.map((row) => editionAccountView(row, edition));
    const fileTag = editionFileTag(title);
    const date = edition.end_date;

    if (kind === 'daily' || kind === 'summary') {
      await downloadDailyAccountsPDF({
        date,
        rows: views,
        title: kind === 'summary' ? 'Resumen Cuenta Corriente' : undefined,
        groupName,
        periodText: title,
        fileTag,
      });
      return true;
    }

    const orgName = await fetchOrganizationName(organizationId);
    const expenses = (
      await fetchExpenses({
        polla_edition_id: editionId,
        polla_group_id: effectiveGroupId,
        polla_organization_id: organizationId,
      })
    ).map((e) => ({ nombre: e.name, monto: Number(e.amount) }));

    if (kind === 'collections') {
      await printDailyTotalsTicket({
        data: views,
        date,
        orgName,
        groupName,
        expenses,
        periodText: title,
        fileTag,
      });
    } else {
      await printSubtotalsDayTicket({
        data: views,
        date,
        orgName,
        groupName,
        expenses,
        percentage: Number(percentage) || 0,
        periodText: title,
        fileTag,
      });
    }
    return true;
  };

  const printMany = async () => {
    if (from > to) {
      toast.error('La fecha desde tiene que ser anterior a la fecha hasta');
      return false;
    }
    if (checked.length === 0) {
      toast.error('Elegí al menos una edición');
      return false;
    }
    if (checked.length > MAX_EDITIONS) {
      toast.error(`Elegí hasta ${MAX_EDITIONS} ediciones`);
      return false;
    }
    if (kind === 'liquidation') return exportManySlips();

    // Cada renglón lleva el título de su edición: dos que empiezan el mismo
    // día (la regular y la especial) no se confunden.
    const titles = new Map(
      checked.map((entry) => [entry.edition.polla_edition_id, titleOf(entry)])
    );
    const totals = (
      await fetchEditionTotals(
        checked.map((entry) => entry.edition.polla_edition_id),
        effectiveGroupId,
        organizationId
      )
    ).map((row) => ({ ...row, label: titles.get(row.polla_edition_id) }));
    if (!totals.length) {
      toast.error('Sin datos para esas ediciones');
      return false;
    }

    if (kind === 'daily' || kind === 'summary') {
      await downloadDailySummaryPDF({ from, to, totals, groupName });
      return true;
    }
    const orgName = await fetchOrganizationName(organizationId);
    if (kind === 'collections') {
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
    return true;
  };

  const handlePrint = async () => {
    try {
      setPrinting(true);
      const done = many ? await printMany() : await printOne();
      if (done) onClose();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el reporte');
    } finally {
      setPrinting(false);
    }
  };

  const handleExportPicked = async (selected: IPollaEditionAccountRow[]) => {
    try {
      setPrinting(true);
      await downloadLiquidationSlipsPDF({
        accounts: selected.map((row) => editionAccountView(row, edition)),
        cashierCodeOf: cashierCode,
        headerLabel: title,
        fileTag: editionFileTag(title),
      });
      onClose();
    } catch {
      toast.error('No se pudieron exportar las liquidaciones');
    } finally {
      setPrinting(false);
    }
  };

  if (picking) {
    return (
      <CashierPickDialog
        title="Exportar liquidación"
        description="Se descarga un PDF por pasador. Los que no tienen movimiento en la edición vienen sin tildar."
        items={picking}
        idOf={(row) => row.polla_user_id}
        labelOf={(row) => {
          const code = cashierCode(row);
          return `${code ? `${code} · ` : ''}${row.user_name}`;
        }}
        totalOf={(row) => row.total}
        hasMovement={hasEditionMovement}
        actionLabel={(count) => `Exportar ${count} ${count === 1 ? 'PDF' : 'PDFs'}`}
        busyLabel="Exportando…"
        busy={printing}
        onConfirm={handleExportPicked}
        onClose={onClose}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <ModeToggle<Scope>
            id="edition-report-scope"
            value={scope}
            onChange={setScope}
            options={SCOPE_OPTIONS}
          />
          {hasGroup && <GroupSelect groups={groups} value={groupId} onChange={setGroupId} />}

          {many ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <DateField id="edition-report-from" label="Desde" value={from} onChange={setFrom} />
                <DateField id="edition-report-to" label="Hasta" value={to} onChange={setTo} />
              </div>
              {inRange.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay ediciones en ese rango.</p>
              ) : (
                <ul
                  className="max-h-48 overflow-y-auto rounded-md border p-2"
                  aria-label="Ediciones"
                >
                  {inRange.map((entry) => {
                    const id = entry.edition.polla_edition_id;
                    return (
                      <li key={id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={`edition-pick-${id}`}
                          checked={!unchecked.has(id)}
                          onCheckedChange={(on) => toggle(id, on === true)}
                        />
                        <Label
                          htmlFor={`edition-pick-${id}`}
                          className="min-w-0 flex-1 cursor-pointer truncate font-normal"
                        >
                          {titleOf(entry)}
                        </Label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{title}</p>
          )}

          {hasPercentage && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="edition-report-percentage">Porcentaje del capitalista</Label>
              <Input
                id="edition-report-percentage"
                inputMode="decimal"
                className="w-28"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </div>
          )}

          {hasExpenses && (
            <EditionExpensesEditor
              editionId={editionId}
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
