import { X } from 'lucide-react';
import { IPollaGroupEntityFront } from '@helper/polla/types/catalog.type';
import { IPollaOrgExpenseEntityFront } from '@helper/polla/types/game.type';
import { useOrgExpenses } from '@/hooks/fetchs/usePollaData';
import { useDeleteExpense } from '@/hooks/mutations/usePollaMutations';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { todayIso } from '@/lib/dates';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { groupLabel } from '@/lib/pollaGroups';
import { ALL_GROUPS, ReportMode, fmtMoney } from '../format';

/** Día o rango de fechas, como el radio de los modales de QuiniApp. */
export const ModeToggle = <T extends string = ReportMode>({
  value,
  onChange,
  id = 'report-mode',
  label = 'Tipo de reporte',
  disabled = false,
  options = [
    ['day', 'Día'],
    ['range', 'Rango de fechas'],
  ] as unknown as readonly (readonly [T, string])[],
}: {
  value: T;
  onChange: (mode: T) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  /** Pares `[valor, texto]`; por defecto "Día | Rango de fechas". */
  options?: readonly (readonly [T, string])[];
}) => (
  <div className="flex flex-col gap-1">
    <Label id={`${id}-label`}>{label}</Label>
    <div
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      className="inline-flex w-fit rounded-md border bg-card p-1"
    >
      {options.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          disabled={disabled}
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
              {groupLabel(group)}
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
    <DateInput id={id} value={value} max={todayIso()} onValueChange={onChange} />
  </div>
);

/** Lista de gastos con su total y, salvo en solo lectura, el botón de eliminar de cada uno. */
export const ExpenseItems = ({
  expenses,
  organizationId,
  readOnly = false,
}: {
  expenses: IPollaOrgExpenseEntityFront[];
  organizationId: string | null;
  readOnly?: boolean;
}) => {
  const { mutate: deleteExpense } = useDeleteExpense();
  const total = expenses.reduce((acc, expense) => acc + Number(expense.amount), 0);

  if (expenses.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-md border p-2 text-sm">
      {expenses.map((expense) => (
        <li key={expense.polla_org_expense_id} className="flex items-center gap-2">
          <span className="flex-1 truncate">{expense.name}</span>
          <span className="tabular-nums">${fmtMoney(expense.amount)}</span>
          {!readOnly && (
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
          )}
        </li>
      ))}
      <li className="flex justify-between border-t pt-1 font-semibold">
        <span>Total gastos</span>
        <span className="tabular-nums">${fmtMoney(total)}</span>
      </li>
    </ul>
  );
};

/**
 * Gastos de un día (historial por fechas), solo lectura. Los gastos se cargan
 * y se eliminan por edición (`EditionExpensesEditor`).
 */
export const ExpensesList = ({
  date,
  groupId,
  organizationId,
}: {
  date: string;
  groupId: string | null;
  organizationId: string | null;
}) => {
  const { data: expenses = [] } = useOrgExpenses({
    date,
    polla_group_id: groupId,
    polla_organization_id: organizationId,
  });

  return (
    <div className="flex flex-col gap-2">
      <Label>Gastos del día</Label>
      <ExpenseItems expenses={expenses} organizationId={organizationId} readOnly />
    </div>
  );
};

/** Pestañas de la cuenta corriente (`role="tablist"`). */
export const AccountTabs = <T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div
    role="tablist"
    aria-label="Cuenta corriente"
    className="inline-flex w-fit rounded-md border bg-card p-1"
  >
    {tabs.map((item) => (
      <button
        key={item.value}
        type="button"
        role="tab"
        aria-selected={value === item.value}
        onClick={() => onChange(item.value)}
        className={cn(
          'rounded px-3 py-1.5 text-sm font-medium transition-colors',
          value === item.value
            ? 'bg-nav-active text-nav-active-foreground'
            : 'text-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        {item.label}
      </button>
    ))}
  </div>
);
