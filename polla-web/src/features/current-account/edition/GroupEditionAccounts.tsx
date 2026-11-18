import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Printer, Receipt, Wallet } from 'lucide-react';
import {
  IPollaEditionAccountListItem,
  IPollaGroupEditionAccountEntity,
  IPollaGroupEditionAccountPreview,
  pollaEditionTitle,
} from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import {
  useEditionAccountList,
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
import {
  printGroupEditionLiquidationTicket,
  printGroupEditionLiquidationTickets,
} from '@/functions/current-account/groupLiquidationTicket';
import {
  groupAccountOutdated,
  groupCommission,
  groupLiquidatable,
  groupLiquidationPercentage,
  groupSplit,
  groupsToSelectAll,
  parseAmount,
} from '@/lib/editionAccount';
import { cn } from '@/lib/utils';
import { fetchOrganizationName } from '../fetchers';
import { fmtMoney } from '../format';
import { EditionExpensesEditor } from './EditionExpensesEditor';
import { useCashierCode } from './useCashierCode';

const OUTDATED_TEXT = 'Cambió desde la liquidación del grupo';
const LOCKED_HINT = 'Configurado en el admin del grupo (Grupos).';

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

/** Imprime el ticket del grupo con el título de la edición en lugar del rango de fechas. */
const printTicket = async (
  account: IPollaGroupEditionAccountEntity,
  organizationId: string | null,
  periodText: string
) => {
  try {
    await printGroupEditionLiquidationTicket({
      account,
      orgName: await fetchOrganizationName(organizationId),
      periodText,
    });
  } catch {
    toast.error('No se pudo imprimir el ticket');
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

/**
 * Liquidar un grupo en la edición: solo el % del admin (fijo si el admin lo
 * tiene configurado). Muestra cuánto del total es para el admin (el 100% de su
 * comisión, que le transfiere el capitalista por afuera) y cuánto para el
 * capitalista.
 */
const LiquidateGroupDialog = ({
  preview,
  adminPercentage,
  editionId,
  title,
  onClose,
}: {
  preview: IPollaGroupEditionAccountPreview;
  adminPercentage: number | null;
  editionId: string;
  title: string;
  onClose: () => void;
}) => {
  const { organizationId } = useAuth();
  const initial = groupLiquidationPercentage(adminPercentage, preview.account);
  const [percentage, setPercentage] = useState(initial.value);
  const { mutate: liquidate, isPending } = useLiquidateGroupEdition();

  const total = Number(preview.base);
  const split = groupSplit(total, groupCommission(total, parseAmount(percentage) ?? 0));

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
      },
      {
        onSuccess: (saved) => {
          onClose();
          void printTicket(saved, organizationId, title);
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Liquidando…' : 'Liquidar e imprimir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * "Liquidar seleccionados": una fila por grupo con su % (fijo si el admin lo
 * tiene, si no a mano) y lo que va al admin y al capitalista. Se liquidan
 * todos juntos (si uno falla, ninguno) y sale un PDF con un ticket por grupo.
 */
const LiquidateGroupsDialog = ({
  previews,
  adminPercentageOf,
  editionId,
  title,
  onClose,
  onDone,
}: {
  previews: IPollaGroupEditionAccountPreview[];
  adminPercentageOf: (groupId: string) => number | null;
  editionId: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { organizationId } = useAuth();
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
    const split = groupSplit(total, groupCommission(total, parseAmount(raw) ?? 0));
    return { preview, total, raw, split, locked: initial.get(preview.polla_group_id)?.locked };
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
        })),
      },
      {
        onSuccess: async (saved) => {
          onDone();
          onClose();
          try {
            await printGroupEditionLiquidationTickets({
              accounts: saved,
              orgName: await fetchOrganizationName(organizationId),
              periodText: title,
            });
          } catch {
            toast.error('No se pudieron imprimir los tickets');
          }
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            Liquidar {previews.length} {previews.length === 1 ? 'grupo' : 'grupos'}
          </DialogTitle>
          <DialogDescription>
            {title}. Se liquidan todos juntos: si uno no se puede, no se liquida ninguno. Sale un
            ticket por grupo.
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
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Los % deshabilitados son los configurados en el admin de cada grupo.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Liquidando…' : 'Liquidar e imprimir'}
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

/** Estado del grupo en la edición: liquidado, desactualizado, pendientes o carga abierta. */
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
}

/** Celular: una tarjeta por grupo con la edición elegida, lo que dejó y su liquidación. */
const GroupCard = ({
  preview,
  adminPercentage,
  loadOpen,
  selected,
  onSelect,
  onLiquidate,
  editionId,
  organizationId,
  caption,
}: GroupRowProps & { editionId: string; organizationId: string | null; caption: string }) => {
  const { account, pending_cashiers: pending } = preview;
  const outdated = groupAccountOutdated(preview);
  const split = account ? groupSplit(account.base, account.admin_commission) : null;
  const liquidatable = groupLiquidatable(preview, loadOpen);
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
        <Button type="button" size="sm" disabled={!liquidatable} onClick={onLiquidate}>
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
  onExpenses,
}: GroupRowProps & { onExpenses: () => void }) => {
  const { account } = preview;
  const outdated = groupAccountOutdated(preview);
  const split = account ? groupSplit(account.base, account.admin_commission) : null;
  const liquidatable = groupLiquidatable(preview, loadOpen);
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
          <Button type="button" size="sm" disabled={!liquidatable} onClick={onLiquidate}>
            <Wallet />
            Liquidar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

/**
 * Liquidaciones de grupo de la edición. Una que quedó vieja (cambió lo que
 * dejaron los pasadores o los gastos) se marca, y reimprimirla pide
 * confirmación.
 */
const GroupEditionHistory = ({
  editionId,
  title,
  organizationId,
  previews,
}: {
  editionId: string;
  title: string;
  organizationId: string | null;
  previews: IPollaGroupEditionAccountPreview[];
}) => {
  const accountsQuery = useGroupEditionAccounts({
    polla_edition_id: editionId,
  });
  const { data: accounts = [], isFetching } = accountsQuery;
  const [confirming, setConfirming] = useState<IPollaGroupEditionAccountEntity | null>(null);

  const outdatedGroups = useMemo(
    () =>
      new Set(
        previews.filter((preview) => groupAccountOutdated(preview)).map((p) => p.polla_group_id)
      ),
    [previews]
  );

  const reprint = (account: IPollaGroupEditionAccountEntity) => {
    if (outdatedGroups.has(account.polla_group_id)) setConfirming(account);
    else void printTicket(account, organizationId, title);
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
    <div className="overflow-x-auto rounded-md border bg-card text-card-foreground">
      {confirming && (
        <ConfirmDialog
          title={OUTDATED_TEXT}
          description={`La liquidación de ${confirming.group_name} no tiene lo que dejaron hoy sus pasadores o los gastos de la edición. El ticket sale con los valores de la liquidación. Para que salga al día, volvé a liquidar el grupo.`}
          confirmLabel="Imprimir igual"
          onConfirm={() => {
            const account = confirming;
            setConfirming(null);
            void printTicket(account, organizationId, title);
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
                <TableCell className="text-right tabular-nums">${fmtMoney(account.base)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(account.admin_percentage)}%
                </TableCell>
                <TableCell
                  className={cn('text-right font-semibold tabular-nums', outdatedAmount(outdated))}
                >
                  ${fmtMoney(split.admin)}
                </TableCell>
                <TableCell
                  className={cn('text-right font-semibold tabular-nums', outdatedAmount(outdated))}
                >
                  ${fmtMoney(split.capitalist)}
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
      </Table>
    </div>
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
  const catalogs = useDrawCatalogs(organizationId);
  const { groupById } = useCashierCode();
  // Para el selector alcanzan las 200 más nuevas, sin contadores.
  const listQuery = useEditionAccountList({
    polla_organization_id: organizationId ?? undefined,
    counts: false,
    limit: 200,
  });
  const list = listQuery.data?.data;
  const [editionId, setEditionId] = useState<string | null>(null);
  const [liquidating, setLiquidating] = useState<IPollaGroupEditionAccountPreview | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [expensesOf, setExpensesOf] = useState<IPollaGroupEditionAccountPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const editions = useMemo(() => list ?? [], [list]);

  // Arranca en la primera edición de la lista (la más nueva), aunque tenga la
  // carga abierta: en el selector se marca con "· Carga abierta".
  useEffect(() => {
    if (!editionId && editions.length > 0) setEditionId(editions[0].edition.polla_edition_id);
  }, [editionId, editions]);
  // Al cambiar de edición se suelta la selección.
  useEffect(() => setSelected(new Set()), [editionId]);

  const current = editions.find((item) => item.edition.polla_edition_id === editionId);
  const title = current ? pollaEditionTitle(current.edition, catalogs) : '';
  const caption = current ? editionCaption(current, title) : '';
  const loadOpen = current?.load_open ?? false;

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
  const selectedPreviews = previews.filter((preview) => selected.has(preview.polla_group_id));

  const toggle = (groupId: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  const toggleAll = (checked: boolean) => setSelected(new Set(checked ? toSelectAll : []));

  if (listQuery.isError && !list) return <ErrorState onRetry={() => void listQuery.refetch()} />;
  if (!list) return <EmptyState message="Cargando…" />;
  if (editions.length === 0) return <EmptyState message="No hay ediciones." />;

  const rowProps = (preview: IPollaGroupEditionAccountPreview) => ({
    preview,
    adminPercentage: adminPercentageOf(preview.polla_group_id),
    loadOpen,
    selected: selected.has(preview.polla_group_id),
    onSelect: (checked: boolean) => toggle(preview.polla_group_id, checked),
    onLiquidate: () => setLiquidating(preview),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:w-[360px]">
        <Label>Edición</Label>
        <Select value={editionId ?? ''} onValueChange={setEditionId}>
          <SelectTrigger>
            <SelectValue placeholder="Elegí una edición" />
          </SelectTrigger>
          <SelectContent>
            {editions.map((item) => (
              <SelectItem key={item.edition.polla_edition_id} value={item.edition.polla_edition_id}>
                {pollaEditionTitle(item.edition, catalogs)} ·{' '}
                {dayjs(item.edition.start_date).format('DD/MM/YYYY')}
                {item.load_open && ' · Carga abierta'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    disabled={selectedPreviews.length === 0}
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
              organizationId={organizationId}
              previews={previews}
            />
          </div>
        </>
      )}

      {liquidating && editionId && (
        <LiquidateGroupDialog
          preview={liquidating}
          adminPercentage={adminPercentageOf(liquidating.polla_group_id)}
          editionId={editionId}
          title={title}
          onClose={() => setLiquidating(null)}
        />
      )}
      {batchOpen && editionId && selectedPreviews.length > 0 && (
        <LiquidateGroupsDialog
          previews={selectedPreviews}
          adminPercentageOf={adminPercentageOf}
          editionId={editionId}
          title={title}
          onClose={() => setBatchOpen(false)}
          onDone={() => setSelected(new Set())}
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
