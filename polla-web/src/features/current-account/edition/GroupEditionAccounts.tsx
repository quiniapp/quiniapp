import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Printer, Wallet } from 'lucide-react';
import {
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
import { useLiquidateGroupEdition } from '@/hooks/mutations/usePollaMutations';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
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
import { printGroupEditionLiquidationTicket } from '@/functions/current-account/groupLiquidationTicket';
import { groupAccountOutdated, groupCommission, groupSplit } from '@/lib/editionAccount';
import { cn } from '@/lib/utils';
import { fetchOrganizationName } from '../fetchers';
import { fmtMoney } from '../format';
import { EditionExpensesEditor } from './EditionExpensesEditor';

const OUTDATED_TEXT = 'Cambió desde la liquidación del grupo';

/** Monto guardado en una liquidación vieja: tachado y apagado. */
const outdatedAmount = (outdated: boolean) =>
  outdated ? 'text-muted-foreground line-through' : undefined;

const OutdatedNotice = () => (
  <p className="flex items-center gap-1.5 rounded-md border border-warning bg-warning/10 px-2 py-1 text-xs">
    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
    {OUTDATED_TEXT}: volvé a liquidar el grupo.
  </p>
);

/** Acepta coma decimal. */
const parseAmount = (raw: string): number | null => {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
};

const Amount = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>
      ${fmtMoney(value)}
    </span>
  </div>
);

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

/**
 * Liquidar un grupo en la edición: solo el % del admin. Muestra cuánto del
 * total es para el admin (el 100% de su comisión, que le transfiere el
 * capitalista por afuera) y cuánto para el capitalista.
 */
const LiquidateGroupDialog = ({
  preview,
  editionId,
  title,
  onClose,
}: {
  preview: IPollaGroupEditionAccountPreview;
  editionId: string;
  title: string;
  onClose: () => void;
}) => {
  const { organizationId } = useAuth();
  const { account } = preview;
  const [percentage, setPercentage] = useState(
    account ? String(Number(account.admin_percentage)) : ''
  );
  const { mutate: liquidate, isPending } = useLiquidateGroupEdition();

  const total = Number(preview.base);
  const split = groupSplit(total, groupCommission(total, parseAmount(percentage) ?? 0));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const adminPercentage = parseAmount(percentage);

    if (adminPercentage === null || adminPercentage < 0 || adminPercentage > 100) {
      toast.error('Poné el porcentaje del admin (0 a 100)');
      return;
    }

    liquidate(
      {
        editionId,
        polla_group_id: preview.polla_group_id,
        admin_percentage: adminPercentage,
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

          <div className="flex flex-col gap-1 sm:w-1/3">
            <Label htmlFor="group-edition-percentage">% del admin</Label>
            <Input
              id="group-edition-percentage"
              inputMode="decimal"
              autoFocus
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
            />
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

/** Una tarjeta por grupo con lo que dejó la edición y, si ya se liquidó, su liquidación. */
const GroupCard = ({
  preview,
  editionId,
  organizationId,
  onLiquidate,
}: {
  preview: IPollaGroupEditionAccountPreview;
  editionId: string;
  organizationId: string | null;
  onLiquidate: () => void;
}) => {
  const { account, pending_cashiers: pending } = preview;
  const outdated = groupAccountOutdated(preview);
  const split = account ? groupSplit(account.base, account.admin_commission) : null;
  return (
    <li className="flex flex-col gap-3 rounded-md border bg-card p-3 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{preview.group_name}</p>
          {account && (
            <Badge variant="success" className="mt-1">
              Liquidado el {dayjs(account.edited_at).format('DD/MM/YYYY')}
            </Badge>
          )}
        </div>
        <Button type="button" size="sm" disabled={pending.length > 0} onClick={onLiquidate}>
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
        {account && split && (
          <>
            <dt className="text-muted-foreground">% del admin</dt>
            <dd className="text-right tabular-nums">{Number(account.admin_percentage)}%</dd>
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
  const { data: accounts = [], isFetching } = useGroupEditionAccounts({
    polla_edition_id: editionId,
  });
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
 * liquidación con el % del admin.
 */
export const GroupEditionAccounts = () => {
  const { organizationId } = useAuth();
  const catalogs = useDrawCatalogs(organizationId);
  const { data: list } = useEditionAccountList({
    polla_organization_id: organizationId ?? undefined,
  });
  const [editionId, setEditionId] = useState<string | null>(null);
  const [liquidating, setLiquidating] = useState<IPollaGroupEditionAccountPreview | null>(null);

  const editions = useMemo(() => list ?? [], [list]);

  // Arranca en la primera edición de la lista.
  useEffect(() => {
    if (!editionId && editions.length > 0) setEditionId(editions[0].edition.polla_edition_id);
  }, [editionId, editions]);

  const selected = editions.find((item) => item.edition.polla_edition_id === editionId);
  const title = selected ? pollaEditionTitle(selected.edition, catalogs) : '';

  const { data: previews = [], isFetching } = useGroupEditionPreviews(editionId);

  if (!list) return <EmptyState message="Cargando…" />;
  if (editions.length === 0) return <EmptyState message="No hay ediciones." />;

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
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {editionId && (
        <>
          {previews.length === 0 ? (
            <EmptyState message={isFetching ? 'Cargando…' : 'No hay grupos'} />
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {previews.map((preview) => (
                <GroupCard
                  key={preview.polla_group_id}
                  preview={preview}
                  editionId={editionId}
                  organizationId={organizationId}
                  onLiquidate={() => setLiquidating(preview)}
                />
              ))}
            </ul>
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
          editionId={editionId}
          title={title}
          onClose={() => setLiquidating(null)}
        />
      )}
    </div>
  );
};
