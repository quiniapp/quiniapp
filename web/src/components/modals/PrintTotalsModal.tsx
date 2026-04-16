import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { PlusIcon, XIcon } from 'lucide-react';
import Modal from './custom-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/hooks/fetchs/organization/useGroups';
import { fetchCurrentAccount } from '@/hooks/fetchs/current-account/useGetCurrentAccount';
import { fetchCurrentAccountTotals } from '@/hooks/fetchs/current-account/useGetCurrentAccountTotals';
import { printDailyTotalsTicket, printRangeTotalsTicket } from '@/functions/printTotalsTicket';
import { useGetOrgExpenses, type OrgExpense } from '@/hooks/fetchs/org-expense/useGetOrgExpenses';
import { useCreateOrgExpense } from '@/hooks/mutations/org-expense/useCreateOrgExpense';
import { useDeleteOrgExpense } from '@/hooks/mutations/org-expense/useDeleteOrgExpense';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { BACKEND_ROUTES } from '../../../routes/routes';

const ALL_GROUPS = '__all__';

interface PrintTotalsModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  initialDate?: string | null;
  initialGroupId?: string | null;
}

const PrintTotalsModal = ({
  isOpen,
  onClose,
  initialDate,
  initialGroupId,
}: PrintTotalsModalProps) => {
  const { organizationId, role } = useAuth();
  const { data: groups } = useGroups(organizationId, role);

  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [date, setDate] = useState<string>(initialDate ?? dayjs().format('YYYY-MM-DD'));

  // Sync date from URL param each time modal opens
  useEffect(() => {
    if (isOpen && initialDate) setDate(initialDate);
  }, [isOpen, initialDate]);
  const [dateFrom, setDateFrom] = useState<string>(dayjs().startOf('week').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [groupId, setGroupId] = useState<string>(initialGroupId || ALL_GROUPS);
  const [percentage, setPercentage] = useState<number>(50);
  const [printing, setPrinting] = useState(false);
  const [orgName, setOrgName] = useState<string>('');

  // New expense form state (before saving)
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  const effectiveGroupId = groupId === ALL_GROUPS ? null : groupId;
  const selectedGroup = groups?.find((g) => g.organization_id === groupId);

  // Load existing expenses from DB for selected date
  const { data: savedExpenses = [] } = useGetOrgExpenses(mode === 'day' ? date : null);
  const { mutate: createExpense, isPending: creating } = useCreateOrgExpense();
  const { mutate: deleteExpense } = useDeleteOrgExpense(date);

  useEffect(() => {
    if (!isOpen || !organizationId) return;
    fetchWithAuth(BACKEND_ROUTES.organization.id(organizationId))
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((json) => setOrgName(json?.data?.organization?.name ?? ''))
      .catch(() => setOrgName(''));
  }, [isOpen, organizationId]);

  const handleAddExpense = () => {
    const name = newExpenseName.trim();
    const amount = Number(newExpenseAmount);
    if (!name || !amount) {
      toast.error('Ingresá nombre y monto.');
      return;
    }
    createExpense(
      { date, name, amount },
      {
        onSuccess: () => {
          setNewExpenseName('');
          setNewExpenseAmount('');
        },
        onError: () => toast.error('Error al guardar el gasto.'),
      }
    );
  };

  const handleDeleteExpense = (expense: OrgExpense) => {
    deleteExpense(expense.expense_id, {
      onError: () => toast.error('Error al eliminar el gasto.'),
    });
  };

  const totalExpenses = savedExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  const handlePrint = async () => {
    try {
      setPrinting(true);

      if (mode === 'day') {
        const data = await fetchCurrentAccount(date, effectiveGroupId);
        if (!data.length) {
          toast.error('Sin datos para esa fecha.');
          return;
        }
        await printDailyTotalsTicket({
          data,
          date,
          orgName,
          groupName: selectedGroup?.name,
          expenses: savedExpenses.map((e) => ({ nombre: e.name, monto: e.amount })),
        });
        toast.success('Ticket generado.');
      } else {
        const dailyTotals = await fetchCurrentAccountTotals(dateFrom, dateTo, effectiveGroupId);
        if (!dailyTotals.length) {
          toast.error('Sin datos para ese rango.');
          return;
        }
        await printRangeTotalsTicket({
          dailyTotals,
          date_from: dateFrom,
          date_to: dateTo,
          percentage,
          orgName,
          groupName: selectedGroup?.name,
        });
        toast.success('Ticket generado.');
      }

      onClose();
    } catch {
      toast.error('Error al generar el ticket.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imprimir Totales" className="max-w-md">
      <div className="space-y-4">
        {/* Modo */}
        <div className="space-y-2">
          <Label>Tipo de reporte</Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as 'day' | 'range')}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="day" id="mode-day" />
              <Label htmlFor="mode-day" className="cursor-pointer">
                Día
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="range" id="mode-range" />
              <Label htmlFor="mode-range" className="cursor-pointer">
                Rango de fechas
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Grupo */}
        {groups && groups.length > 0 && (
          <div className="space-y-1">
            <Label>Grupo</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GROUPS}>Todos los grupos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.organization_id} value={g.organization_id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Modo día */}
        {mode === 'day' && (
          <>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <SelectDayToSearch
                selectedDay={date}
                onDayChange={(d) => d && setDate(d)}
                className="w-full"
              />
            </div>

            {/* Gastos persistidos */}
            <div className="space-y-2">
              <Label>Gastos del día</Label>

              {/* Lista de gastos guardados */}
              {savedExpenses.map((exp) => (
                <div key={exp.expense_id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{exp.name}</span>
                  <span className="text-sm w-24 text-right">
                    {new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(exp.amount)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteExpense(exp)}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Form para agregar nuevo gasto */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nombre del gasto"
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Monto"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="w-28"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddExpense}
                  disabled={creating}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>

              {totalExpenses > 0 && (
                <div className="text-sm text-right opacity-70">
                  Total gastos:{' '}
                  {new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(
                    totalExpenses
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Modo rango */}
        {mode === 'range' && (
          <>
            <div className="space-y-1">
              <Label>Desde</Label>
              <SelectDayToSearch
                selectedDay={dateFrom}
                onDayChange={(d) => d && setDateFrom(d)}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <SelectDayToSearch
                selectedDay={dateTo}
                onDayChange={(d) => d && setDateTo(d)}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <Label>Porcentaje capitalista (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
                className="w-28"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={printing}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} disabled={printing}>
            {printing ? 'Generando...' : 'Imprimir'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PrintTotalsModal;
