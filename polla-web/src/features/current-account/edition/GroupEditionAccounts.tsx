import { FormEvent, Fragment, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarRange,
  Check,
  FileText,
  FolderArchive,
  Printer,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  IPollaDrawCatalogs,
  IPollaEditionAccountListItem,
  IPollaEditionEntityFront,
  IPollaGroupEditionAccountEntity,
  IPollaGroupEditionAccountPreview,
  isPollaSpecialEdition,
  pollaEditionTitle,
} from '@helper/polla/types/game.type';
import { POLLA_GROUP_REPORT_MAX_DAYS } from '@helper/polla/config/session.config';
import { useAuth } from '@/providers/AuthContext';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import {
  useEditionAccountPages,
  useEditionById,
  useGroupEditionAccounts,
  useGroupEditionPreviews,
} from '@/hooks/fetchs/usePollaData';
import {
  useLiquidateGroupEdition,
  useLiquidateGroupEditions,
} from '@/hooks/mutations/usePollaMutations';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  downloadGroupLiquidationPDF,
  prepareGroupLiquidations,
} from '@/functions/current-account/groupLiquidationPDF';
import {
  type LiquidationFormat,
  deliverLiquidation,
} from '@/functions/current-account/liquidationDelivery';
import {
  groupAccountOutdated,
  groupCommission,
  groupLiquidatable,
  groupLiquidationPercentage,
  groupSplit,
  groupsToSelectAll,
  owedWord,
  parseAmount,
} from '@/lib/editionAccount';
import { cn } from '@/lib/utils';
import { todayIso } from '@/lib/dates';
import { pollaDailyReportName } from '@/lib/exportNames';
import {
  GroupRef,
  groupRangeByEdition,
  groupReportDate,
  groupReportRows,
  groupReportTotals,
  outdatedGroupNames,
  unliquidatedGroupNames,
} from '@/lib/groupDailyReport';
import {
  downloadGroupDailyReportPDF,
  downloadGroupRangeReportPDF,
} from '@/functions/current-account/groupDailyReportPDF';
import {
  type GroupMovementAmounts,
  type GroupMovementInputs,
  type GroupMovementKey,
  groupLiquidationLabel,
  groupLiquidationSheets,
  groupLiquidationTotals,
  groupMovementPayload,
  groupOwed,
  groupOwedAfterLiquidation,
  groupPaid,
  groupPaymentStatus,
  groupRowOwed,
  readGroupMovementInputs,
} from '@/lib/groupLiquidation';
import { groupLiquidationZipName } from '@/lib/liquidationZip';
import { EditionSelect } from '@/features/bets/EditionSelect';
import { uniqueById } from '@/lib/editionSelect';
import { fetchEditionsByIds, fetchGroupAccountsRange, fetchOrganizationName } from '../fetchers';
import { CashierPickDialog } from '../dialogs/ExportLiquidationsDialog';
import { exportActionLabel, useLiquidationDelivery } from '../dialogs/LiquidationFormat';
import { DateField } from '../dialogs/shared';
import { useOrganizationName } from '../useOrganizationName';
import { fmtMoney, fmtOwed } from '../format';
import { EditionExpensesEditor } from './EditionExpensesEditor';
import { GroupMovementsDialog } from './GroupMovementsDialog';
import { useCashierCode } from './useCashierCode';

const OUTDATED_TEXT = 'Cambió desde la liquidación del grupo';
const LOCKED_HINT = 'Configurado en el admin del grupo (Grupos).';
const INVALID_AMOUNT_TEXT = 'El cobro no puede ser negativo';
const NOT_LIQUIDATABLE_TEXT = 'Se carga al liquidar: la carga sigue abierta o faltan pasadores';
const NO_PERCENTAGE_TEXT = 'Sin % configurado: sale al elegirlo en Liquidar';

/** Cobros de "Grupos a liquidar": lo escrito se suma al liquidar el grupo. */
const MOVEMENT_INPUTS = [{ key: 'collection', had: 'collections', label: 'Cobros' }] as const;

type ReadMovements = ReturnType<typeof readGroupMovementInputs>;

/** Lo que tenía el grupo (cobros guardados), para el "Tenía $X". */
const hadAmount = (
  account: IPollaGroupEditionAccountEntity | null,
  key: (typeof MOVEMENT_INPUTS)[number]['had']
) => Number(account?.[key] ?? 0);

/** El grupo tiene cobros cargados en la edición. */
const hasGroupMovements = (account: IPollaGroupEditionAccountEntity | null) =>
  Boolean(account) && hadAmount(account, 'collections') > 0;

/** La celda donde se escribe el cobro que se suma hoy (tabla y tarjeta). */
const MovementInput = ({
  groupName,
  label,
  value,
  invalid,
  disabled,
  onChange,
  className,
}: {
  groupName: string;
  label: string;
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  className?: string;
}) => (
  <Input
    aria-label={`${label} de ${groupName}`}
    aria-invalid={invalid || undefined}
    inputMode="decimal"
    placeholder="+ 0"
    disabled={disabled}
    title={disabled ? NOT_LIQUIDATABLE_TEXT : invalid ? INVALID_AMOUNT_TEXT : undefined}
    className={cn(
      'h-8 w-24 shrink-0 text-right tabular-nums aria-[invalid]:border-destructive',
      className
    )}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
);

/** Pagado (verde), Pendiente, o "—" si no hay nada que saldar. */
const PaymentStatus = ({ account }: { account: IPollaGroupEditionAccountEntity }) => {
  const status = groupPaymentStatus(account);
  if (status === 'Pagado') {
    return (
      <Badge variant="success">
        <Check aria-hidden />
        Pagado
      </Badge>
    );
  }
  if (status === 'Pendiente') return <Badge variant="outline">Pendiente</Badge>;
  return <span className="text-muted-foreground">—</span>;
};

/** Monto guardado en una liquidación vieja: tachado y apagado. */
const outdatedAmount = (outdated: boolean) =>
  outdated ? 'text-muted-foreground line-through' : undefined;

const OutdatedNotice = () => (
  <p className="flex items-center gap-1.5 rounded-md border border-warning bg-warning/10 px-2 py-1 text-xs">
    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
    {OUTDATED_TEXT}: volvé a liquidar el grupo.
  </p>
);

const Amount = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>
      ${fmtMoney(value)}
    </span>
  </div>
);

/** `Edición <título> · DD/MM/YYYY al DD/MM/YYYY[ · Carga abierta]`: qué edición se está viendo. */
const editionCaption = (item: IPollaEditionAccountListItem, title: string) =>
  `Edición ${title} · ${dayjs(item.edition.start_date).format('DD/MM/YYYY')} al ${dayjs(
    item.edition.end_date
  ).format('DD/MM/YYYY')}${item.load_open ? ' · Carga abierta' : ''}`;

const editionAccountIdOf = (item: IPollaEditionAccountListItem) => item.edition.polla_edition_id;

/**
 * La elegida cuando ya no está en las páginas cargadas, armada con la edición
 * pedida por id. Sin la lista no se sabe si la carga sigue abierta: se toma
 * cerrada (liquidar con la carga abierta lo rechaza la base igual).
 */
const editionAccountFallback = (
  edition: IPollaEditionEntityFront
): IPollaEditionAccountListItem => ({
  edition,
  liquidated_at: null,
  liquidated_by_name: null,
  cashiers_count: null,
  liquidated_count: null,
  owed_by_cashiers: null,
  owed_to_cashiers: null,
  load_open: false,
});

interface SheetsContext {
  groupById: Map<string, GroupRef>;
  organizationId: string | null;
  /** El nombre ya cargado (`useOrganizationName`); sin él (o vacío) se pide al exportar. */
  orgName?: string;
  title: string;
  /** Edición especial: el ZIP y sus archivos llevan el prefijo `polla_plus_`. */
  special: boolean;
}

/** Las hojas de las liquidaciones, con el nombre de la organización ya cargado si se puede. */
const sheetsOf = async (accounts: IPollaGroupEditionAccountEntity[], ctx: SheetsContext) =>
  groupLiquidationSheets(accounts, {
    groupNumberOf: (groupId) => ctx.groupById.get(groupId)?.number,
    orgName: ctx.orgName || (await fetchOrganizationName(ctx.organizationId)),
    editionTitle: ctx.title,
    today: todayIso(),
    special: ctx.special,
  });

/** Un archivo por grupo (aunque sea uno solo), listo para entregar. */
const prepareZip = async (
  accounts: IPollaGroupEditionAccountEntity[],
  ctx: SheetsContext,
  format: LiquidationFormat
) => {
  const sheets = await sheetsOf(accounts, ctx);
  return prepareGroupLiquidations({
    sheets,
    format,
    zipName: groupLiquidationZipName({
      date: sheets[0]?.date ?? todayIso(),
      special: ctx.special,
    }),
  });
};

/** Baja el ZIP con un PDF por grupo (al liquidar no hay selector de formato). */
const exportZip = async (accounts: IPollaGroupEditionAccountEntity[], ctx: SheetsContext) => {
  const prepared = await prepareZip(accounts, ctx, 'pdf');
  if (prepared) await deliverLiquidation(prepared);
};

/** Exporta tras liquidar: si falla, avisa (la liquidación ya quedó guardada). */
const exportZipOrToast = async (
  accounts: IPollaGroupEditionAccountEntity[],
  ctx: SheetsContext
) => {
  try {
    await exportZip(accounts, ctx);
  } catch (error) {
    console.error(error);
    toast.error('No se pudieron exportar las liquidaciones');
  }
};

/** Baja la hoja A4 suelta de un grupo, con el título de la edición. */
const downloadSheet = async (account: IPollaGroupEditionAccountEntity, ctx: SheetsContext) => {
  try {
    const [sheet] = await sheetsOf([account], ctx);
    await downloadGroupLiquidationPDF(sheet);
  } catch (error) {
    console.error(error);
    toast.error('No se pudo descargar la liquidación');
  }
};

/** El % de un grupo: deshabilitado si es el del admin; si no, se escribe a mano. */
const PercentageInput = ({
  id,
  value,
  locked,
  onChange,
  autoFocus,
  ariaLabel,
}: {
  id: string;
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  ariaLabel?: string;
}) => (
  <Input
    id={id}
    inputMode="decimal"
    aria-label={ariaLabel}
    autoFocus={autoFocus && !locked}
    disabled={locked}
    title={locked ? LOCKED_HINT : undefined}
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
  />
);

/** `null` si el % escrito no vale (vacío, no numérico o fuera de 0–100). */
const validPercentage = (raw: string) => {
  const value = parseAmount(raw);
  return value === null || value < 0 || value > 100 ? null : value;
};

/** Lo que ya tenía el grupo en cobros (va en los diálogos de liquidar). */
const previousMovementsText = (account: IPollaGroupEditionAccountEntity | null) =>
  hasGroupMovements(account)
    ? `Ya tenía cobros por $${fmtMoney(hadAmount(account, 'collections'))}.`
    : null;

/**
 * Liquidar un grupo en la edición: el % del admin (fijo si el admin lo tiene
 * configurado) y el cobro escrito en la tabla. Muestra cuánto del
 * total es para el admin (el 100% de su comisión, que le transfiere el
 * capitalista por afuera), cuánto para el capitalista y cómo queda el Debe.
 */
const LiquidateGroupDialog = ({
  preview,
  adminPercentage,
  added,
  editionId,
  title,
  special,
  groupById,
  onClose,
  onLiquidated,
}: {
  preview: IPollaGroupEditionAccountPreview;
  adminPercentage: number | null;
  /** Cobro escrito en la fila del grupo (0 = nada). */
  added: GroupMovementAmounts;
  editionId: string;
  title: string;
  special: boolean;
  groupById: Map<string, GroupRef>;
  onClose: () => void;
  /** Liquidó bien: se vacían los Cobros escritos del grupo. */
  onLiquidated: () => void;
}) => {
  const { organizationId } = useAuth();
  const { data: orgName } = useOrganizationName(organizationId);
  const initial = groupLiquidationPercentage(adminPercentage, preview.account);
  const [percentage, setPercentage] = useState(initial.value);
  const { mutate: liquidate, isPending } = useLiquidateGroupEdition();

  const total = Number(preview.base);
  const commission = groupCommission(total, parseAmount(percentage) ?? 0);
  const split = groupSplit(total, commission);
  const owed = groupOwedAfterLiquidation(preview.account, { total, commission }, added);
  const previous = previousMovementsText(preview.account);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = validPercentage(percentage);

    if (value === null) {
      toast.error('Poné el porcentaje del admin (0 a 100)');
      return;
    }

    liquidate(
      {
        editionId,
        polla_group_id: preview.polla_group_id,
        // Con el % del admin configurado la base usa ese.
        admin_percentage: initial.locked ? null : value,
        ...groupMovementPayload(added),
      },
      {
        onSuccess: (saved) => {
          onLiquidated();
          onClose();
          void exportZipOrToast([saved], { groupById, organizationId, orgName, title, special });
        },
      }
    );
  };

  // Mientras guarda no se cierra (Escape, afuera o Cancelar): el vaciado de lo escrito
  // corre en el onSuccess de este diálogo y, desmontado, no correría (doble cobro).
  return (
    <Dialog open onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Liquidar {preview.group_name}</DialogTitle>
          <DialogDescription>
            {title}. Al admin se le paga el 100% de su comisión; el resto del total es del
            capitalista.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Amount label="Deja pasadores" value={Number(preview.cashiers_subtotal)} />
            <Amount label="Gastos del grupo" value={-Number(preview.expenses) || 0} />
            <Amount label="Total" value={total} strong />
          </div>

          <div className="flex flex-col gap-1 sm:w-1/2">
            <Label htmlFor="group-edition-percentage">% del admin</Label>
            <PercentageInput
              id="group-edition-percentage"
              value={percentage}
              locked={initial.locked}
              onChange={setPercentage}
              autoFocus
            />
            {initial.locked && <p className="text-xs text-muted-foreground">{LOCKED_HINT}</p>}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Amount label="Total para el admin" value={split.admin} strong />
            <Amount label="Total para el capitalista" value={split.capitalist} strong />
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Amount label="Cobros a sumar" value={added.collection} />
              <Amount label={`${owedWord(owed)} al liquidar`} value={Math.abs(owed)} strong />
            </div>
            <p className="text-xs text-muted-foreground">
              {previous ? `${previous} ` : ''}Lo que se suma se escribe en Cobros del grupo, antes
              de liquidar.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Liquidando…' : 'Liquidar y exportar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * "Liquidar seleccionados": una fila por grupo con su % (fijo si el admin lo
 * tiene, si no a mano), lo que va al admin y al capitalista, el cobro
 * escrito y cómo queda el Debe. Se liquidan todos juntos (si uno falla,
 * ninguno) y se baja un ZIP con un PDF por grupo.
 */
const LiquidateGroupsDialog = ({
  previews,
  adminPercentageOf,
  addedOf,
  editionId,
  title,
  special,
  groupById,
  onClose,
  onDone,
}: {
  previews: IPollaGroupEditionAccountPreview[];
  adminPercentageOf: (groupId: string) => number | null;
  /** Cobro escrito en la fila de cada grupo (0 = nada). */
  addedOf: (groupId: string) => GroupMovementAmounts;
  editionId: string;
  title: string;
  special: boolean;
  groupById: Map<string, GroupRef>;
  onClose: () => void;
  /** Liquidaron bien: se sueltan esos grupos y se vacía lo que tenían escrito. */
  onDone: (groupIds: string[]) => void;
}) => {
  const { organizationId } = useAuth();
  const { data: orgName } = useOrganizationName(organizationId);
  const initial = useMemo(
    () =>
      new Map(
        previews.map((preview) => [
          preview.polla_group_id,
          groupLiquidationPercentage(adminPercentageOf(preview.polla_group_id), preview.account),
        ])
      ),
    [previews, adminPercentageOf]
  );
  const [percentages, setPercentages] = useState<Record<string, string>>(() =>
    Object.fromEntries([...initial].map(([id, p]) => [id, p.value]))
  );
  const { mutate: liquidateMany, isPending } = useLiquidateGroupEditions();

  const rows = previews.map((preview) => {
    const total = Number(preview.base);
    const raw = percentages[preview.polla_group_id] ?? '';
    const commission = groupCommission(total, parseAmount(raw) ?? 0);
    const split = groupSplit(total, commission);
    const added = addedOf(preview.polla_group_id);
    const owed = groupOwedAfterLiquidation(preview.account, { total, commission }, added);
    return {
      preview,
      total,
      raw,
      split,
      added,
      owed,
      locked: initial.get(preview.polla_group_id)?.locked,
    };
  });
  const sum = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((acc, row) => acc + pick(row), 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = rows.find((row) => !row.locked && validPercentage(row.raw) === null);
    if (invalid) {
      toast.error(`Poné el porcentaje del admin de ${invalid.preview.group_name} (0 a 100)`);
      return;
    }

    liquidateMany(
      {
        editionId,
        groups: rows.map((row) => ({
          polla_group_id: row.preview.polla_group_id,
          admin_percentage: row.locked ? null : validPercentage(row.raw),
          ...groupMovementPayload(row.added),
        })),
      },
      {
        onSuccess: async (saved) => {
          onDone(rows.map((row) => row.preview.polla_group_id));
          onClose();
          await exportZipOrToast(saved, { groupById, organizationId, orgName, title, special });
        },
      }
    );
  };

  // Mientras guarda no se cierra (Escape, afuera o Cancelar): el vaciado de lo escrito
  // corre en el onSuccess de este diálogo y, desmontado, no correría (doble cobro).
  return (
    <Dialog open onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>
            Liquidar {previews.length} {previews.length === 1 ? 'grupo' : 'grupos'}
          </DialogTitle>
          <DialogDescription>
            {title}. Se liquidan todos juntos: si uno no se puede, no se liquida ninguno. Se
            descarga un ZIP con un PDF por grupo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-24">% admin</TableHead>
                  <TableHead className="text-right">Admin</TableHead>
                  <TableHead className="text-right">Capitalista</TableHead>
                  <TableHead className="text-right">Cobros</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.preview.polla_group_id}>
                    <TableCell className="font-medium">{row.preview.group_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.total)}
                    </TableCell>
                    <TableCell>
                      <PercentageInput
                        id={`group-batch-${row.preview.polla_group_id}`}
                        ariaLabel={`% del admin de ${row.preview.group_name}`}
                        value={row.raw}
                        locked={Boolean(row.locked)}
                        onChange={(value) =>
                          setPercentages((prev) => ({
                            ...prev,
                            [row.preview.polla_group_id]: value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.split.admin)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.split.capitalist)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${fmtMoney(row.added.collection)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {fmtOwed(row.owed)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(sum((row) => row.total))}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(sum((row) => row.split.admin))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(sum((row) => row.split.capitalist))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(sum((row) => row.added.collection))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {fmtOwed(sum((row) => row.owed))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Los % deshabilitados son los configurados en el admin de cada grupo. Cobros es lo
            escrito en cada grupo; el Debe incluye los cobros que ya tenía.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Liquidando…' : 'Liquidar y exportar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** Gastos de un grupo en la edición (en la tabla de la computadora van en un diálogo). */
const ExpensesDialog = ({
  preview,
  editionId,
  organizationId,
  onClose,
}: {
  preview: IPollaGroupEditionAccountPreview;
  editionId: string;
  organizationId: string | null;
  onClose: () => void;
}) => (
  <Dialog open onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Gastos de {preview.group_name}</DialogTitle>
        <DialogDescription>Restan del total del grupo en esta edición.</DialogDescription>
      </DialogHeader>
      <EditionExpensesEditor
        editionId={editionId}
        groupId={preview.polla_group_id}
        organizationId={organizationId}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/**
 * Estado del grupo en la edición: liquidado, pagado (Debe 0, con lo
 * liquidado aunque esté desactualizado), desactualizado, pendientes o carga
 * abierta.
 */
const GroupStatus = ({
  preview,
  loadOpen,
}: {
  preview: IPollaGroupEditionAccountPreview;
  loadOpen: boolean;
}) => {
  const { account, pending_cashiers: pending } = preview;
  const outdated = groupAccountOutdated(preview);
  const badges: ReactNode[] = [];
  if (account) {
    badges.push(
      <Badge key="liq" variant="success">
        Liquidado el {dayjs(account.edited_at).format('DD/MM/YYYY')}
      </Badge>
    );
    if (groupPaid(account)) {
      badges.push(
        <Badge key="paid" variant="success">
          <Check aria-hidden />
          Pagado
        </Badge>
      );
    }
  }
  if (outdated) {
    badges.push(
      <Badge key="old" variant="outline" className="border-warning" title={OUTDATED_TEXT}>
        <AlertTriangle className="size-3" aria-hidden />
        Desactualizado
      </Badge>
    );
  }
  if (pending.length > 0) {
    badges.push(
      <Badge
        key="pend"
        variant="outline"
        title={pending.map((c) => `${c.number ? `${c.number} · ` : ''}${c.name}`).join(', ')}
      >
        Faltan {pending.length} {pending.length === 1 ? 'pasador' : 'pasadores'}
      </Badge>
    );
  }
  if (loadOpen) {
    badges.push(
      <Badge key="open" variant="outline">
        Carga abierta
      </Badge>
    );
  }
  if (badges.length === 0) {
    badges.push(
      <Badge key="none" variant="outline">
        Sin liquidar
      </Badge>
    );
  }
  return <div className="flex flex-wrap items-center gap-1">{badges}</div>;
};

const percentageLabel = (value: number | null) => (value === null ? 'A mano' : `${value}%`);

interface GroupRowProps {
  preview: IPollaGroupEditionAccountPreview;
  adminPercentage: number | null;
  loadOpen: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onLiquidate: () => void;
  /** Lo escrito en Cobros del grupo. */
  inputs: Partial<GroupMovementInputs>;
  /** Lo escrito, ya leído: montos (vacío = 0) e inválidos. */
  movements: ReadMovements;
  onInput: (key: GroupMovementKey, value: string) => void;
  /** Abre "Movimientos" (cobros ya cargados). */
  onMovements: () => void;
}

/** Lo que comparten la fila y la tarjeta: si se puede liquidar y el Debe con lo escrito. */
const groupRowState = ({
  preview,
  adminPercentage,
  loadOpen,
  movements,
}: Pick<GroupRowProps, 'preview' | 'adminPercentage' | 'loadOpen' | 'movements'>) => {
  const { account } = preview;
  const liquidatable = groupLiquidatable(preview, loadOpen);
  const invalid = movements.invalid.size > 0;
  return {
    outdated: groupAccountOutdated(preview),
    split: account ? groupSplit(account.base, account.admin_commission) : null,
    liquidatable,
    invalid,
    canLiquidate: liquidatable && !invalid,
    owed: groupRowOwed(preview, adminPercentage, movements.values),
  };
};

/** El Debe de la fila con lo escrito; "—" si el grupo no tiene % y no se liquidó. */
const owedText = (owed: number | null) => (owed === null ? '—' : fmtOwed(owed));

/** `title` del Debe: viejo (desactualizado) o sin % para calcularlo. */
const owedTitle = (owed: number | null, outdated: boolean) =>
  owed === null ? NO_PERCENTAGE_TEXT : outdated ? OUTDATED_TEXT : undefined;

/** Celular: una tarjeta por grupo con la edición elegida, lo que dejó y su liquidación. */
const GroupCard = ({
  preview,
  adminPercentage,
  loadOpen,
  selected,
  onSelect,
  onLiquidate,
  inputs,
  movements,
  onInput,
  onMovements,
  editionId,
  organizationId,
  caption,
}: GroupRowProps & { editionId: string; organizationId: string | null; caption: string }) => {
  const { account, pending_cashiers: pending } = preview;
  const { outdated, split, liquidatable, invalid, canLiquidate, owed } = groupRowState({
    preview,
    adminPercentage,
    loadOpen,
    movements,
  });
  return (
    <li className="flex flex-col gap-3 rounded-md border bg-card p-3 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Checkbox
            className="mt-1"
            checked={selected}
            disabled={!liquidatable}
            aria-label={`Elegir ${preview.group_name} para liquidar`}
            onCheckedChange={(on) => onSelect(on === true)}
          />
          <div className="min-w-0">
            <p className="font-medium">{preview.group_name}</p>
            <p className="text-xs text-muted-foreground">{caption}</p>
            <div className="mt-1">
              <GroupStatus preview={preview} loadOpen={loadOpen} />
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canLiquidate}
          title={invalid ? INVALID_AMOUNT_TEXT : undefined}
          onClick={onLiquidate}
        >
          <Wallet />
          Liquidar grupo
        </Button>
      </div>

      {outdated && <OutdatedNotice />}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Deja pasadores</dt>
        <dd className="text-right tabular-nums">${fmtMoney(preview.cashiers_subtotal)}</dd>
        <dt className="text-muted-foreground">Gastos</dt>
        <dd className="text-right tabular-nums">${fmtMoney(preview.expenses)}</dd>
        <dt className="font-medium">Total</dt>
        <dd className="text-right font-semibold tabular-nums">${fmtMoney(preview.base)}</dd>
        <dt className="text-muted-foreground">% del admin</dt>
        <dd className="text-right tabular-nums">
          {account ? `${Number(account.admin_percentage)}%` : percentageLabel(adminPercentage)}
        </dd>
        {account && split && (
          <>
            <dt className="font-medium">Total para el admin</dt>
            <dd
              className={cn('text-right font-semibold tabular-nums', outdatedAmount(outdated))}
              title={outdated ? OUTDATED_TEXT : undefined}
            >
              ${fmtMoney(split.admin)}
            </dd>
            <dt className="font-medium">Total para el capitalista</dt>
            <dd
              className={cn('text-right font-semibold tabular-nums', outdatedAmount(outdated))}
              title={outdated ? OUTDATED_TEXT : undefined}
            >
              ${fmtMoney(split.capitalist)}
            </dd>
          </>
        )}
      </dl>

      <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
        {MOVEMENT_INPUTS.map((input) => (
          <Fragment key={input.key}>
            <dt>
              <span className="block">{input.label}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                Tenía ${fmtMoney(hadAmount(account, input.had))}
              </span>
            </dt>
            <dd>
              <MovementInput
                groupName={preview.group_name}
                label={input.label}
                value={inputs[input.key] ?? ''}
                invalid={movements.invalid.has(input.key)}
                disabled={!liquidatable}
                onChange={(value) => onInput(input.key, value)}
              />
            </dd>
          </Fragment>
        ))}
        <dt className="font-medium">Debe</dt>
        <dd
          className={cn('text-right font-semibold tabular-nums', outdatedAmount(outdated))}
          title={owedTitle(owed, outdated)}
        >
          {owedText(owed)}
        </dd>
      </dl>
      {invalid && <p className="text-xs text-destructive">{INVALID_AMOUNT_TEXT}.</p>}
      {hasGroupMovements(account) && (
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={onMovements}>
          <ArrowLeftRight />
          Movimientos
        </Button>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">Falta liquidar:</span>
          {pending.map((cashier) => (
            <Badge key={cashier.polla_user_id} variant="outline">
              {cashier.number ? `${cashier.number} · ` : ''}
              {cashier.name}
            </Badge>
          ))}
        </div>
      )}

      <EditionExpensesEditor
        editionId={editionId}
        groupId={preview.polla_group_id}
        organizationId={organizationId}
      />
    </li>
  );
};

/** Computadora: una fila por grupo con casilla, montos, estado y acciones. */
const GroupTableRow = ({
  preview,
  adminPercentage,
  loadOpen,
  selected,
  onSelect,
  onLiquidate,
  inputs,
  movements,
  onInput,
  onMovements,
  onExpenses,
}: GroupRowProps & { onExpenses: () => void }) => {
  const { account } = preview;
  const { outdated, split, liquidatable, invalid, canLiquidate, owed } = groupRowState({
    preview,
    adminPercentage,
    loadOpen,
    movements,
  });
  return (
    <TableRow data-state={selected ? 'selected' : undefined}>
      <TableCell>
        <Checkbox
          checked={selected}
          disabled={!liquidatable}
          aria-label={`Elegir ${preview.group_name} para liquidar`}
          onCheckedChange={(on) => onSelect(on === true)}
        />
      </TableCell>
      <TableCell className="font-medium">{preview.group_name}</TableCell>
      <TableCell className="text-right tabular-nums">
        {account ? `${Number(account.admin_percentage)}%` : percentageLabel(adminPercentage)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        ${fmtMoney(preview.cashiers_subtotal)}
      </TableCell>
      <TableCell className="text-right tabular-nums">${fmtMoney(preview.expenses)}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        ${fmtMoney(preview.base)}
      </TableCell>
      <TableCell
        className={cn('text-right tabular-nums', outdatedAmount(outdated))}
        title={outdated ? OUTDATED_TEXT : undefined}
      >
        {split ? `$${fmtMoney(split.admin)}` : '—'}
      </TableCell>
      <TableCell
        className={cn('text-right tabular-nums', outdatedAmount(outdated))}
        title={outdated ? OUTDATED_TEXT : undefined}
      >
        {split ? `$${fmtMoney(split.capitalist)}` : '—'}
      </TableCell>
      {MOVEMENT_INPUTS.map((input) => (
        <TableCell key={input.key} className="text-right">
          <span className="block whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            Tenía ${fmtMoney(hadAmount(account, input.had))}
          </span>
          <MovementInput
            groupName={preview.group_name}
            label={input.label}
            value={inputs[input.key] ?? ''}
            invalid={movements.invalid.has(input.key)}
            disabled={!liquidatable}
            onChange={(value) => onInput(input.key, value)}
            className="ml-auto w-20"
          />
        </TableCell>
      ))}
      <TableCell
        className={cn(
          'whitespace-nowrap text-right font-semibold tabular-nums',
          outdatedAmount(outdated)
        )}
        title={owedTitle(owed, outdated)}
      >
        {owedText(owed)}
      </TableCell>
      <TableCell>
        <GroupStatus preview={preview} loadOpen={loadOpen} />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Gastos"
            aria-label={`Gastos de ${preview.group_name}`}
            onClick={onExpenses}
          >
            <Receipt />
          </Button>
          {hasGroupMovements(account) && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Movimientos"
              aria-label={`Movimientos de ${preview.group_name}`}
              onClick={onMovements}
            >
              <ArrowLeftRight />
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!canLiquidate}
            title={invalid ? INVALID_AMOUNT_TEXT : undefined}
            onClick={onLiquidate}
          >
            <Wallet />
            Liquidar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

/**
 * Liquidaciones de grupo de la edición, con sus cobros, Debe y estado
 * (solo para mirar), el "Total general" y debajo "Falta cobrar". Una que
 * quedó vieja (cambió lo que dejaron los pasadores o los gastos) se marca, y
 * reimprimirla pide confirmación.
 */
const GroupEditionHistory = ({
  editionId,
  title,
  special,
  organizationId,
  groupById,
  previews,
}: {
  editionId: string;
  title: string;
  special: boolean;
  organizationId: string | null;
  groupById: Map<string, GroupRef>;
  previews: IPollaGroupEditionAccountPreview[];
}) => {
  const { data: orgName } = useOrganizationName(organizationId);
  const accountsQuery = useGroupEditionAccounts({
    polla_edition_id: editionId,
  });
  const { data: accounts = [], isFetching } = accountsQuery;
  const [confirming, setConfirming] = useState<IPollaGroupEditionAccountEntity | null>(null);
  // Fila "Total general": suma de los grupos liquidados de la edición.
  const totals = useMemo(() => groupLiquidationTotals(accounts), [accounts]);

  const outdatedGroups = useMemo(
    () =>
      new Set(
        previews.filter((preview) => groupAccountOutdated(preview)).map((p) => p.polla_group_id)
      ),
    [previews]
  );

  const reprint = (account: IPollaGroupEditionAccountEntity) => {
    if (outdatedGroups.has(account.polla_group_id)) setConfirming(account);
    else void downloadSheet(account, { groupById, organizationId, orgName, title, special });
  };

  if (accountsQuery.isError && !accountsQuery.data) {
    return <ErrorState onRetry={() => void accountsQuery.refetch()} />;
  }
  if (accounts.length === 0) {
    return (
      <EmptyState message={isFetching ? 'Cargando…' : 'Todavía no hay liquidaciones de grupo'} />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border bg-card text-card-foreground">
        {confirming && (
          <ConfirmDialog
            title={OUTDATED_TEXT}
            description={`La liquidación de ${confirming.group_name} no tiene lo que dejaron hoy sus pasadores o los gastos de la edición. La hoja sale con los valores de la liquidación. Para que salga al día, volvé a liquidar el grupo.`}
            confirmLabel="Descargar igual"
            onConfirm={() => {
              const account = confirming;
              setConfirming(null);
              void downloadSheet(account, {
                groupById,
                organizationId,
                orgName,
                title,
                special,
              });
            }}
            onCancel={() => setConfirming(null)}
          />
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-right">Deja pasadores</TableHead>
              <TableHead className="text-right">Gastos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">% admin</TableHead>
              <TableHead className="text-right">Total admin</TableHead>
              <TableHead className="text-right">Total capitalista</TableHead>
              <TableHead className="text-right">Cobros</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const outdated = outdatedGroups.has(account.polla_group_id);
              const split = groupSplit(account.base, account.admin_commission);
              return (
                <TableRow key={account.polla_group_edition_account_id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {account.group_name}
                      {outdated && (
                        <span
                          role="img"
                          aria-label={OUTDATED_TEXT}
                          title={OUTDATED_TEXT}
                          className="shrink-0 text-amber-600"
                        >
                          <AlertTriangle className="size-4" />
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(account.cashiers_subtotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(account.expenses)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(account.base)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(account.admin_percentage)}%
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      outdatedAmount(outdated)
                    )}
                  >
                    ${fmtMoney(split.admin)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      outdatedAmount(outdated)
                    )}
                  >
                    ${fmtMoney(split.capitalist)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${fmtMoney(account.collections)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap text-right font-semibold tabular-nums',
                      outdatedAmount(outdated)
                    )}
                  >
                    {fmtOwed(groupOwed(account))}
                  </TableCell>
                  <TableCell>
                    <PaymentStatus account={account} />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Imprimir"
                      aria-label={`Imprimir la liquidación de ${account.group_name}`}
                      onClick={() => reprint(account)}
                    >
                      <Printer />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell>Total general</TableCell>
              <TableCell className="text-right tabular-nums">
                ${fmtMoney(totals.cashiersSubtotal)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                ${fmtMoney(totals.expenses)}
              </TableCell>
              <TableCell className="text-right tabular-nums">${fmtMoney(totals.total)}</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">${fmtMoney(totals.admin)}</TableCell>
              <TableCell className="text-right tabular-nums">
                ${fmtMoney(totals.capitalist)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                ${fmtMoney(totals.collections)}
              </TableCell>
              {/* Debe neto: los negativos (Cobra) restan. */}
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {fmtOwed(totals.owed)}
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {/* Solo los Debe positivos: lo que los grupos todavía tienen que transferir. */}
      <p className="text-sm">
        Falta cobrar <span className="font-semibold tabular-nums">${fmtMoney(totals.missing)}</span>
      </p>
    </div>
  );
};

/**
 * Parte diario de grupos por rango: Desde y Hasta (hasta hoy, como máximo 62
 * días) por fecha de liquidación. Una fila por edición y el resumen por grupo.
 */
const GroupRangeReportDialog = ({
  groupById,
  catalogs,
  organizationId,
  onClose,
}: {
  groupById: Map<string, GroupRef>;
  /** Para titular las ediciones del rango, que se piden por id al generar. */
  catalogs: IPollaDrawCatalogs;
  organizationId: string | null;
  onClose: () => void;
}) => {
  const today = todayIso();
  const [from, setFrom] = useState(() => dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!from || !to) {
      toast.error('Elegí las dos fechas');
      return;
    }
    if (from > to) {
      toast.error('La fecha desde tiene que ser anterior a la fecha hasta');
      return;
    }
    if (to > today) {
      toast.error('La fecha hasta no puede ser posterior a hoy');
      return;
    }
    if (dayjs(to).diff(dayjs(from), 'day') + 1 > POLLA_GROUP_REPORT_MAX_DAYS) {
      toast.error(`El rango no puede pasar de ${POLLA_GROUP_REPORT_MAX_DAYS} días`);
      return;
    }

    setBusy(true);
    try {
      const accounts = await fetchGroupAccountsRange(from, to, organizationId);
      if (accounts.length === 0) {
        toast.error('No hay grupos liquidados en ese rango');
        return;
      }
      const groups = groupReportRows(accounts, groupById);
      const editionRows = groupRangeByEdition(accounts);
      // Las ediciones del rango pueden no estar cargadas en el selector.
      const editions = await fetchEditionsByIds(
        editionRows.map((row) => row.editionId),
        organizationId
      );
      const titles = new Map(
        editions.map((edition) => [edition.polla_edition_id, pollaEditionTitle(edition, catalogs)])
      );
      await downloadGroupRangeReportPDF({
        from,
        to,
        editions: editionRows.map((row) => ({
          ...row,
          title: titles.get(row.editionId) ?? 'Edición',
        })),
        groups,
        totals: groupReportTotals(groups),
        fileName: pollaDailyReportName({ date: from, to, groups: true }),
      });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el parte diario');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Parte diario de grupos por rango</DialogTitle>
          <DialogDescription>
            Suma los partes diarios de las ediciones con grupos liquidados entre las dos fechas (por
            fecha de liquidación): una fila por edición y el resumen por grupo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <DateField id="group-range-from" label="Desde" value={from} onChange={setFrom} />
            <DateField id="group-range-to" label="Hasta" value={to} onChange={setTo} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Generando…' : 'Generar PDF'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Pestaña "Grupos" de la cuenta corriente: la cuenta de cada grupo en una
 * edición (lo que dejaron sus pasadores menos los gastos del grupo) y su
 * liquidación con el % del admin (el configurado en el admin o, si no tiene,
 * a mano). En la computadora es una tabla; en el celular, tarjetas. Se pueden
 * elegir varios grupos y liquidarlos juntos.
 */
export const GroupEditionAccounts = () => {
  const { organizationId } = useAuth();
  const { data: orgName } = useOrganizationName(organizationId);
  const catalogs = useDrawCatalogs(organizationId);
  const { groupById } = useCashierCode();
  // El selector trae de a 10 (de la más nueva a la más vieja), sin contadores,
  // y la página siguiente al llegar al final del desplegable.
  const pagesQuery = useEditionAccountPages(
    { polla_organization_id: organizationId ?? undefined },
    10
  );
  const pages = pagesQuery.data?.pages;
  const [editionId, setEditionId] = useState<string | null>(null);
  const [liquidating, setLiquidating] = useState<IPollaGroupEditionAccountPreview | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [expensesOf, setExpensesOf] = useState<IPollaGroupEditionAccountPreview | null>(null);
  const [movementsOf, setMovementsOf] = useState<IPollaGroupEditionAccountPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Cobros escritos por grupo: los leen la fila, la tarjeta y los dos
  // diálogos de liquidar; se vacían al liquidar bien.
  const [movementInputs, setMovementInputs] = useState<
    Record<string, Partial<GroupMovementInputs>>
  >({});
  const [rangeOpen, setRangeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Aparte de `exporting`: el parte diario no muestra "Generando…" al exportar liquidaciones.
  const [exportingLiquidations, setExportingLiquidations] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [format, setFormat] = useState<LiquidationFormat>('pdf');
  const delivery = useLiquidationDelivery();
  // Lo ya preparado deja de valer si cambia el formato o se cierra la lista.
  const { reset: resetDelivery } = delivery;
  useEffect(() => resetDelivery(), [format, pickOpen, resetDelivery]);
  // Al cerrar la lista el formato vuelve a PDF.
  useEffect(() => {
    if (!pickOpen) setFormat('pdf');
  }, [pickOpen]);

  const editions = useMemo(
    () => uniqueById(pages?.flatMap((page) => page.data) ?? [], editionAccountIdOf),
    [pages]
  );
  /** `<título> · DD/MM/YYYY[ · Carga abierta]`. */
  const optionLabel = useCallback(
    (item: IPollaEditionAccountListItem) =>
      `${pollaEditionTitle(item.edition, catalogs)} · ${dayjs(item.edition.start_date).format(
        'DD/MM/YYYY'
      )}${item.load_open ? ' · Carga abierta' : ''}`,
    [catalogs]
  );

  // Arranca en la primera edición de la lista (la más nueva), aunque tenga la
  // carga abierta: en el selector se marca con "· Carga abierta".
  useEffect(() => {
    if (!editionId && editions.length > 0) setEditionId(editions[0].edition.polla_edition_id);
  }, [editionId, editions]);
  // Al cambiar de edición se sueltan la selección y lo escrito.
  useEffect(() => {
    setSelected(new Set());
    setMovementInputs({});
  }, [editionId]);

  const listed = editions.find((item) => item.edition.polla_edition_id === editionId);
  // La elegida sale de lo cargado; si ya no está (cambió la lista), se pide por id.
  const { data: fetched } = useEditionById(
    editionId && pagesQuery.isSuccess && !listed ? editionId : null
  );
  const fallback = useMemo(
    () =>
      fetched && fetched.polla_edition_id === editionId
        ? editionAccountFallback(fetched)
        : undefined,
    [fetched, editionId]
  );
  const current = listed ?? fallback;
  const title = current ? pollaEditionTitle(current.edition, catalogs) : '';
  const caption = current ? editionCaption(current, title) : '';
  const loadOpen = current?.load_open ?? false;
  const special = current ? isPollaSpecialEdition(current.edition) : false;

  const previewsQuery = useGroupEditionPreviews(editionId);
  const { data: previewsData, isFetching } = previewsQuery;
  // La consulta deja ver la edición anterior mientras carga la nueva: acá solo
  // van los grupos de la edición elegida, para no tildar ni liquidar sobre otra.
  const previews = useMemo(
    () => (previewsData ?? []).filter((preview) => preview.polla_edition_id === editionId),
    [previewsData, editionId]
  );

  /** El % configurado en el admin del grupo (`null`: se carga a mano). */
  const adminPercentageOf = useMemo(
    () => (groupId: string) => {
      const value = groupById.get(groupId)?.admin?.admin_percentage;
      return value === null || value === undefined ? null : Number(value);
    },
    [groupById]
  );

  const toSelectAll = useMemo(() => groupsToSelectAll(previews, loadOpen), [previews, loadOpen]);
  const allSelected = toSelectAll.length > 0 && toSelectAll.every((id) => selected.has(id));
  // Un grupo que dejó de poder liquidarse no se manda aunque siga tildado o con un monto escrito.
  const selectedPreviews = previews.filter(
    (preview) => selected.has(preview.polla_group_id) && groupLiquidatable(preview, loadOpen)
  );

  const toggle = (groupId: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  const toggleAll = (checked: boolean) => setSelected(new Set(checked ? toSelectAll : []));

  const movementsOfGroup = (groupId: string) => readGroupMovementInputs(movementInputs[groupId]);
  const setMovementInput = (groupId: string, key: GroupMovementKey, value: string) =>
    setMovementInputs((prev) => ({ ...prev, [groupId]: { ...prev[groupId], [key]: value } }));
  const clearMovementInputs = (groupIds: string[]) =>
    setMovementInputs((prev) => {
      const next = { ...prev };
      for (const id of groupIds) delete next[id];
      return next;
    });
  /** "Liquidar seleccionados" no va mientras un grupo elegido tenga un cobro o pago inválido. */
  const selectedInvalid = selectedPreviews.some(
    (preview) => movementsOfGroup(preview.polla_group_id).invalid.size > 0
  );

  /**
   * Parte diario de grupos de la edición elegida: solo los grupos liquidados,
   * con lo guardado al liquidar; los que faltan van como aviso.
   */
  const handleExportDaily = async () => {
    if (!current) return;
    const accounts = previews.flatMap((preview) => (preview.account ? [preview.account] : []));
    if (accounts.length === 0) {
      toast.error('Todavía no hay grupos liquidados en esta edición');
      return;
    }
    setExporting(true);
    try {
      const rows = groupReportRows(accounts, groupById);
      const date = groupReportDate(accounts) ?? todayIso();
      await downloadGroupDailyReportPDF({
        editionTitle: title,
        date,
        rows,
        totals: groupReportTotals(rows),
        unliquidated: unliquidatedGroupNames(previews),
        outdated: outdatedGroupNames(previews),
        fileName: pollaDailyReportName({
          special: isPollaSpecialEdition(current.edition),
          date,
          groups: true,
        }),
      });
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el parte diario');
    } finally {
      setExporting(false);
    }
  };

  /** Recién cambió la edición: la lista todavía vacía no quiere decir que no haya liquidados. */
  const loadingPreviews = isFetching && previews.length === 0;

  /** "Exportar liquidaciones": abre la lista para elegir qué grupos van al ZIP. */
  const handleOpenExport = () => {
    if (loadingPreviews) return;
    if (!previews.some((preview) => preview.account)) {
      toast.error('Todavía no hay grupos liquidados en esta edición');
      return;
    }
    setPickOpen(true);
  };

  /** Entrega las liquidaciones guardadas de los grupos elegidos (ZIP, o imágenes sueltas en el celular). */
  const handleExportLiquidations = async (chosen: IPollaGroupEditionAccountPreview[]) => {
    const accounts = chosen.flatMap((preview) => (preview.account ? [preview.account] : []));
    setExportingLiquidations(true);
    try {
      const done = await delivery.run(() =>
        prepareZip(accounts, { groupById, organizationId, orgName, title, special }, format)
      );
      if (done) setPickOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron exportar las liquidaciones');
    } finally {
      setExportingLiquidations(false);
    }
  };

  if (pagesQuery.isError && !pages) {
    return <ErrorState onRetry={() => void pagesQuery.refetch()} />;
  }
  if (!pages) return <EmptyState message="Cargando…" />;
  if (editions.length === 0) return <EmptyState message="No hay ediciones." />;

  const rowProps = (preview: IPollaGroupEditionAccountPreview) => ({
    preview,
    adminPercentage: adminPercentageOf(preview.polla_group_id),
    loadOpen,
    selected: selected.has(preview.polla_group_id),
    onSelect: (checked: boolean) => toggle(preview.polla_group_id, checked),
    onLiquidate: () => setLiquidating(preview),
    inputs: movementInputs[preview.polla_group_id] ?? {},
    movements: movementsOfGroup(preview.polla_group_id),
    onInput: (key: GroupMovementKey, value: string) =>
      setMovementInput(preview.polla_group_id, key, value),
    onMovements: () => setMovementsOf(preview),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex w-full flex-col gap-1 sm:w-[360px]">
          <Label>Edición</Label>
          <EditionSelect
            items={editions}
            value={editionId ?? ''}
            onChange={setEditionId}
            idOf={editionAccountIdOf}
            labelOf={optionLabel}
            hasNextPage={Boolean(pagesQuery.hasNextPage)}
            isFetchingNextPage={pagesQuery.isFetchingNextPage}
            fetchNextPage={pagesQuery.fetchNextPage}
            selectedFallback={listed ? undefined : fallback}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!current || exporting}
            onClick={() => void handleExportDaily()}
          >
            <FileText />
            {exporting ? 'Generando…' : 'Parte diario'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!current || exporting || loadingPreviews}
            onClick={handleOpenExport}
          >
            <FolderArchive />
            Exportar liquidaciones
          </Button>
          <Button type="button" variant="outline" onClick={() => setRangeOpen(true)}>
            <CalendarRange />
            Parte diario por rango
          </Button>
        </div>
      </div>

      {editionId && (
        <>
          {previewsQuery.isError && !previewsQuery.data ? (
            <ErrorState onRetry={() => void previewsQuery.refetch()} />
          ) : previews.length === 0 ? (
            <EmptyState message={isFetching ? 'Cargando…' : 'No hay grupos'} />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium" aria-live="polite">
                  {caption}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm md:hidden">
                    <Checkbox
                      checked={allSelected}
                      disabled={toSelectAll.length === 0}
                      onCheckedChange={(on) => toggleAll(on === true)}
                    />
                    Seleccionar todos
                  </label>
                  <Button
                    type="button"
                    disabled={selectedPreviews.length === 0 || selectedInvalid}
                    title={
                      selectedInvalid
                        ? `${INVALID_AMOUNT_TEXT}: corregí los de los grupos elegidos`
                        : undefined
                    }
                    onClick={() => setBatchOpen(true)}
                  >
                    <Wallet />
                    Liquidar seleccionados ({selectedPreviews.length})
                  </Button>
                </div>
              </div>

              <div className="hidden overflow-x-auto rounded-md border bg-card text-card-foreground md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          disabled={toSelectAll.length === 0}
                          aria-label="Seleccionar todos los grupos para liquidar"
                          title="Seleccionar todos (sin liquidar o desactualizados)"
                          onCheckedChange={(on) => toggleAll(on === true)}
                        />
                      </TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="text-right">% admin</TableHead>
                      <TableHead className="text-right">Deja pasadores</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Admin</TableHead>
                      <TableHead className="text-right">Capitalista</TableHead>
                      <TableHead className="text-right">Cobros</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previews.map((preview) => (
                      <GroupTableRow
                        key={preview.polla_group_id}
                        {...rowProps(preview)}
                        onExpenses={() => setExpensesOf(preview)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="grid grid-cols-1 gap-3 md:hidden">
                {previews.map((preview) => (
                  <GroupCard
                    key={preview.polla_group_id}
                    {...rowProps(preview)}
                    editionId={editionId}
                    organizationId={organizationId}
                    caption={caption}
                  />
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Liquidaciones de grupo</h2>
            <GroupEditionHistory
              editionId={editionId}
              title={title}
              special={special}
              organizationId={organizationId}
              groupById={groupById}
              previews={previews}
            />
          </div>
        </>
      )}

      {liquidating && editionId && (
        <LiquidateGroupDialog
          preview={liquidating}
          adminPercentage={adminPercentageOf(liquidating.polla_group_id)}
          added={movementsOfGroup(liquidating.polla_group_id).values}
          editionId={editionId}
          title={title}
          special={special}
          groupById={groupById}
          onClose={() => setLiquidating(null)}
          onLiquidated={() => clearMovementInputs([liquidating.polla_group_id])}
        />
      )}
      {batchOpen && editionId && selectedPreviews.length > 0 && (
        <LiquidateGroupsDialog
          previews={selectedPreviews}
          adminPercentageOf={adminPercentageOf}
          addedOf={(groupId) => movementsOfGroup(groupId).values}
          editionId={editionId}
          title={title}
          special={special}
          groupById={groupById}
          onClose={() => setBatchOpen(false)}
          onDone={(groupIds) => {
            clearMovementInputs(groupIds);
            setSelected(new Set());
          }}
        />
      )}
      {movementsOf && editionId && (
        <GroupMovementsDialog
          editionId={editionId}
          groupId={movementsOf.polla_group_id}
          groupName={movementsOf.group_name}
          organizationId={organizationId}
          onClose={() => setMovementsOf(null)}
        />
      )}
      {pickOpen && (
        <CashierPickDialog
          title="Exportar liquidaciones de grupos"
          description="Se descarga un ZIP con un archivo por grupo (PDF o imagen), con la fecha en el nombre."
          items={previews.filter((preview) => preview.account)}
          idOf={(preview) => preview.polla_group_id}
          labelOf={(preview) =>
            `${groupLiquidationLabel({
              number: groupById.get(preview.polla_group_id)?.number,
              name: preview.group_name,
            })}${groupAccountOutdated(preview) ? ' · ⚠ desactualizada' : ''}`
          }
          totalOf={(preview) => Number(preview.account?.base ?? 0)}
          hasMovement={() => true}
          listLabel="Grupos"
          actionLabel={exportActionLabel}
          busyLabel="Exportando…"
          busy={exportingLiquidations || delivery.busy}
          format={format}
          onFormatChange={setFormat}
          onSelectionChange={delivery.reset}
          pendingShare={
            delivery.pending
              ? () =>
                  void delivery.retry().then((done) => {
                    if (done) setPickOpen(false);
                  })
              : undefined
          }
          onConfirm={(chosen) => void handleExportLiquidations(chosen)}
          onClose={() => setPickOpen(false)}
        />
      )}
      {rangeOpen && (
        <GroupRangeReportDialog
          groupById={groupById}
          catalogs={catalogs}
          organizationId={organizationId}
          onClose={() => setRangeOpen(false)}
        />
      )}
      {expensesOf && editionId && (
        <ExpensesDialog
          preview={expensesOf}
          editionId={editionId}
          organizationId={organizationId}
          onClose={() => setExpensesOf(null)}
        />
      )}
    </div>
  );
};
