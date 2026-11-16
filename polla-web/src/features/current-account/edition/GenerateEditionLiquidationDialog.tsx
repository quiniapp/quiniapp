import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import {
  IPollaEditionAccountListItem,
  IPollaEditionAccountRow,
  IPollaEditionLiquidationDifference,
} from '@helper/polla/types/game.type';
import { IGenerateEditionLiquidationPayload } from '@helper/polla/schemas/game.schema';
import { useGenerateEditionLiquidation } from '@/hooks/mutations/usePollaMutations';
import {
  IEditionNewMovements,
  hasEditionMovement,
  parseAmount,
  withNewMovements,
} from '@/lib/editionAccount';
import { cn } from '@/lib/utils';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtMoney } from '../format';

type Entries = IGenerateEditionLiquidationPayload['entries'];

/** Lo que se escribe en la tabla: se suma hoy como movimiento nuevo. */
const INPUTS = [
  { key: 'claim', column: 'claims', label: 'Reclamos' },
  { key: 'collection', column: 'collections', label: 'Cobros' },
  { key: 'payment', column: 'paid', label: 'Pagos' },
] as const;

type InputKey = (typeof INPUTS)[number]['key'];

const NO_MOVEMENTS: IEditionNewMovements = { claim: 0, collection: 0, payment: 0 };

/**
 * Lo escrito en las celdas de un pasador: vacío es 0. Cobro y pago no pueden
 * ser negativos; el reclamo sí.
 */
const readInputs = (raw: Partial<Record<InputKey, string>> | undefined) => {
  const values = { ...NO_MOVEMENTS };
  const invalid = new Set<InputKey>();
  for (const { key } of INPUTS) {
    const text = raw?.[key] ?? '';
    if (text.trim() === '') continue;
    const value = parseAmount(text);
    if (value === null || (key !== 'claim' && value < 0)) invalid.add(key);
    else values[key] = value;
  }
  return { values, invalid };
};

const Money = ({ value, strong }: { value: number; strong?: boolean }) => (
  <TableCell className={cn('whitespace-nowrap text-right tabular-nums', strong && 'font-semibold')}>
    ${fmtMoney(value)}
  </TableCell>
);

/**
 * "Generar liquidación" de una edición, como el modal de QuiniApp: los
 * pasadores del filtro con casilla (los que tienen jugadas, borradas o
 * movimientos vienen tildados). En Reclamos, Cobros y Pagos se escribe lo que
 * se suma hoy; la tabla muestra el Debe recalculado. Al generar se cargan
 * esos movimientos, se liquida a los tildados y la edición queda marcada como
 * liquidada. Si las jugadas cambiaron desde una liquidación anterior, avisa
 * las diferencias y deja elegir con cuáles seguir.
 */
export const GenerateEditionLiquidationDialog = ({
  item,
  title,
  rows,
  cashierCode,
  onClose,
}: {
  item: IPollaEditionAccountListItem;
  title: string;
  /** Los pasadores del filtro de la pantalla (grupo y pasador). */
  rows: IPollaEditionAccountRow[];
  cashierCode: (row: { polla_group_id: string | null; user_number: number | null }) => string;
  onClose: () => void;
}) => {
  const editionId = item.edition.polla_edition_id;
  const { mutateAsync: generate, isPending } = useGenerateEditionLiquidation();

  const [selected, setSelected] = useState(
    () => new Set(rows.filter(hasEditionMovement).map((row) => row.polla_user_id))
  );
  const [inputs, setInputs] = useState<Record<string, Partial<Record<InputKey, string>>>>({});
  /** Diferencias de jugadas y lo que se mandó, para seguir con el viejo o el nuevo. */
  const [differences, setDifferences] = useState<{
    list: IPollaEditionLiquidationDifference[];
    entries: Entries;
  } | null>(null);

  const codeOf = (row: { polla_group_id: string | null; user_number: number | null }) => {
    const code = cashierCode(row);
    return code ? `${code} · ` : '';
  };

  const parsed = useMemo(
    () => new Map(rows.map((row) => [row.polla_user_id, readInputs(inputs[row.polla_user_id])])),
    [rows, inputs]
  );
  const preview = (row: IPollaEditionAccountRow) =>
    selected.has(row.polla_user_id)
      ? withNewMovements(row, parsed.get(row.polla_user_id)?.values ?? NO_MOVEMENTS)
      : row;

  const chosen = rows.filter((row) => selected.has(row.polla_user_id));
  const owedTotal = chosen.reduce((sum, row) => sum + Number(preview(row).total), 0);
  const allSelected = rows.length > 0 && chosen.length === rows.length;

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const setInput = (id: string, key: InputKey, value: string) =>
    setInputs((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  /** La celda para escribir lo que se suma hoy (en la tabla y en la tarjeta). */
  const amountInput = (
    row: IPollaEditionAccountRow,
    { key, label }: (typeof INPUTS)[number],
    className?: string
  ) => (
    <Input
      aria-label={`${label} de ${row.user_name}`}
      aria-invalid={parsed.get(row.polla_user_id)?.invalid.has(key) || undefined}
      inputMode="decimal"
      placeholder="+ 0"
      disabled={!selected.has(row.polla_user_id) || isPending}
      className={cn(
        'h-8 w-24 shrink-0 text-right tabular-nums aria-[invalid]:border-destructive',
        className
      )}
      value={inputs[row.polla_user_id]?.[key] ?? ''}
      onChange={(event) => setInput(row.polla_user_id, key, event.target.value)}
    />
  );

  const run = async (entries: Entries, source?: 'NEW' | 'OLD') => {
    try {
      const result = await generate({ editionId, entries, ticket_source: source });
      if (result.status === 'DIFFERENCES') {
        setDifferences({ list: result.differences, entries });
        return;
      }
      toast.success(
        `Liquidación generada: ${entries.length} ${entries.length === 1 ? 'pasador' : 'pasadores'}`
      );
      onClose();
    } catch {
      // `useApiMutation` ya mostró el error.
    }
  };

  const handleGenerate = () => {
    if (chosen.length === 0) {
      toast.error('Tildá al menos un pasador');
      return;
    }
    if (chosen.some((row) => (parsed.get(row.polla_user_id)?.invalid.size ?? 0) > 0)) {
      toast.error('Hay montos inválidos: cobros y pagos no pueden ser negativos');
      return;
    }
    void run(
      chosen.map((row) => ({
        polla_user_id: row.polla_user_id,
        ...(parsed.get(row.polla_user_id)?.values ?? NO_MOVEMENTS),
      }))
    );
  };

  if (differences) {
    return (
      <Dialog open onOpenChange={(next) => !next && !isPending && onClose()}>
        <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Cambió desde la última liquidación</DialogTitle>
            <DialogDescription>
              Las jugadas de estos pasadores no son las de su liquidación anterior. Elegí con cuáles
              seguir. Los reclamos, cobros y pagos que escribiste se cargan igual.
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
                {differences.list.map((difference) => (
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
                      <Money key={index} value={value} />
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            El Debe de esta tabla es sin lo que escribiste recién.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDifferences(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => run(differences.entries, 'OLD')}
            >
              Continuar con el viejo
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => run(differences.entries, 'NEW')}
            >
              Continuar con el nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col lg:max-w-[1200px]">
        <DialogHeader>
          <DialogTitle>Generar liquidación · {title}</DialogTitle>
          <DialogDescription>
            Tildá a quién liquidar. En Reclamos, Cobros y Pagos escribí lo que se suma hoy: queda
            como un movimiento nuevo con fecha de hoy (lo que ya tenía se corrige tocando su fila).
            Al generar, la edición queda marcada como liquidada.
          </DialogDescription>
        </DialogHeader>

        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) =>
              setSelected(
                checked === true ? new Set(rows.map((row) => row.polla_user_id)) : new Set()
              )
            }
            aria-label="Seleccionar todos"
          />
          Seleccionar todos ({chosen.length} de {rows.length})
        </label>

        {/* Celular: una tarjeta por pasador. */}
        <ul
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto md:hidden"
          aria-label="Pasadores a liquidar"
        >
          {rows.map((row) => {
            const id = row.polla_user_id;
            const isChosen = selected.has(id);
            const view = preview(row);
            return (
              <li
                key={id}
                className={cn('rounded-md border p-3', !isChosen && 'text-muted-foreground')}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={isChosen}
                    onCheckedChange={(checked) => toggle(id, checked === true)}
                    aria-label={`Liquidar a ${row.user_name}`}
                    disabled={isPending}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1 break-words font-medium">
                    {codeOf(row)}
                    {row.user_name}
                    {row.differs && (
                      <AlertTriangle
                        className="ml-1 inline size-4 text-amber-600"
                        aria-label="Cambió desde la última liquidación"
                      />
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    Debe ${fmtMoney(view.total)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  Pase ${fmtMoney(view.pass)} · Comisión ${fmtMoney(view.cashier_commission)} ·
                  Subtotal ${fmtMoney(view.subtotal)}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {INPUTS.map((input) => (
                    <div key={input.key} className="flex items-center gap-2 text-sm">
                      <span className="w-20 shrink-0">{input.label}</span>
                      {amountInput(row, input)}
                      <span className="min-w-0 text-xs text-muted-foreground tabular-nums">
                        tenía ${fmtMoney(row[input.column])}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="hidden min-h-0 flex-1 overflow-auto rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Pasador</TableHead>
                <TableHead className="whitespace-nowrap text-right">Pase jugadas</TableHead>
                <TableHead className="text-right">Borradas</TableHead>
                <TableHead className="text-right">Pase</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Reclamos</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Cobros</TableHead>
                <TableHead className="text-right">Pagos</TableHead>
                <TableHead className="text-right">Debe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const id = row.polla_user_id;
                const isChosen = selected.has(id);
                const view = preview(row);
                const inputCell = (input: (typeof INPUTS)[number]) => (
                  <TableCell key={input.key} className="text-right">
                    <span className="block whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      Tenía ${fmtMoney(row[input.column])}
                    </span>
                    {amountInput(row, input, 'ml-auto')}
                  </TableCell>
                );
                return (
                  <TableRow key={id} className={cn(!isChosen && 'text-muted-foreground')}>
                    <TableCell>
                      <Checkbox
                        checked={isChosen}
                        onCheckedChange={(checked) => toggle(id, checked === true)}
                        aria-label={`Liquidar a ${row.user_name}`}
                        disabled={isPending}
                      />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="flex items-center gap-1">
                        <span className="truncate">
                          {codeOf(row)}
                          {row.user_name}
                        </span>
                        {row.differs && (
                          <AlertTriangle
                            className="size-4 shrink-0 text-amber-600"
                            aria-label="Cambió desde la última liquidación"
                          />
                        )}
                      </span>
                    </TableCell>
                    <Money value={view.bets_pass} />
                    <Money value={view.deleted_pass} />
                    <Money value={view.pass} />
                    <Money value={view.cashier_commission} />
                    {inputCell(INPUTS[0])}
                    <Money value={view.subtotal} />
                    {inputCell(INPUTS[1])}
                    {inputCell(INPUTS[2])}
                    <Money value={view.total} strong />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-sm">
            Debe de los tildados:{' '}
            <span className="font-semibold tabular-nums">${fmtMoney(owedTotal)}</span>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isPending || chosen.length === 0}
              onClick={handleGenerate}
            >
              {isPending ? 'Generando…' : 'Generar liquidación'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
