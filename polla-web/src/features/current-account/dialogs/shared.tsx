import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { IPollaGroupEntityFront } from '@helper/polla/types/catalog.type';
import { useOrgExpenses } from '@/hooks/fetchs/usePollaData';
import { useCreateExpense, useDeleteExpense } from '@/hooks/mutations/usePollaMutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ALL_GROUPS, ReportMode, fmtMoney } from '../format';

/** Día o rango de fechas, como el radio de los modales de QuiniApp. */
export const ModeToggle = ({
  value,
  onChange,
}: {
  value: ReportMode;
  onChange: (mode: ReportMode) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label id="report-mode-label">Tipo de reporte</Label>
    <div
      role="radiogroup"
      aria-labelledby="report-mode-label"
      className="inline-flex w-fit rounded-md border bg-card p-1"
    >
      {(
        [
          ['day', 'Día'],
          ['range', 'Rango de fechas'],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'rounded px-3 py-1.5 text-sm font-medium transition-colors',
            value === mode
              ? 'bg-nav-active text-nav-active-foreground'
              : 'text-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
);

export const GroupSelect = ({
  groups,
  value,
  onChange,
}: {
  groups: IPollaGroupEntityFront[];
  value: string;
  onChange: (value: string) => void;
}) =>
  groups.length > 0 ? (
    <div className="flex flex-col gap-1">
      <Label>Grupo</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Todos los grupos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_GROUPS}>Todos los grupos</SelectItem>
          {groups.map((group) => (
            <SelectItem key={group.polla_group_id} value={group.polla_group_id}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;

export const DateField = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type="date"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
    />
  </div>
);

/**
 * Gastos del día (de la organización o del grupo elegido). Se guardan al
 * agregarlos, igual que en QuiniApp, y entran en el ticket.
 */
export const ExpensesEditor = ({
  date,
  groupId,
  organizationId,
}: {
  date: string;
  groupId: string | null;
  organizationId: string | null;
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const { data: expenses = [] } = useOrgExpenses({
    date,
    polla_group_id: groupId,
    polla_organization_id: organizationId,
  });
  const { mutate: createExpense, isPending } = useCreateExpense();
  const { mutate: deleteExpense } = useDeleteExpense();

  const total = expenses.reduce((acc, expense) => acc + Number(expense.amount), 0);

  const handleAdd = () => {
    const value = Number(amount.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error('Ingresá nombre y monto');
      return;
    }
    createExpense(
      {
        date,
        name: name.trim(),
        amount: value,
        polla_group_id: groupId,
        ...(organizationId ? { polla_organization_id: organizationId } : {}),
      },
      {
        onSuccess: () => {
          setName('');
          setAmount('');
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Gastos del día</Label>
      {expenses.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border p-2 text-sm">
          {expenses.map((expense) => (
            <li key={expense.polla_org_expense_id} className="flex items-center gap-2">
              <span className="flex-1 truncate">{expense.name}</span>
              <span className="tabular-nums">${fmtMoney(expense.amount)}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`Eliminar gasto ${expense.name}`}
                onClick={() =>
                  deleteExpense({
                    id: expense.polla_org_expense_id,
                    ...(organizationId ? { polla_organization_id: organizationId } : {}),
                  })
                }
              >
                <X />
              </Button>
            </li>
          ))}
          <li className="flex justify-between border-t pt-1 font-semibold">
            <span>Total gastos</span>
            <span className="tabular-nums">${fmtMoney(total)}</span>
          </li>
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          aria-label="Nombre del gasto"
          placeholder="Concepto"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          aria-label="Monto del gasto"
          placeholder="Monto"
          inputMode="decimal"
          className="w-28"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Agregar gasto"
          onClick={handleAdd}
          disabled={isPending}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
};
