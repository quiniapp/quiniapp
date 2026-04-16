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
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { BACKEND_ROUTES } from '../../../routes/routes';

interface ExpenseItem {
  nombre: string;
  monto: number;
}

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
  const [dateFrom, setDateFrom] = useState<string>(
    dayjs().startOf('week').format('YYYY-MM-DD')
  );
  const [dateTo, setDateTo] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [groupId, setGroupId] = useState<string>(initialGroupId ?? '');
  const [percentage, setPercentage] = useState<number>(50);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [printing, setPrinting] = useState(false);
  const [orgName, setOrgName] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !organizationId) return;
    fetchWithAuth(BACKEND_ROUTES.organization.id(organizationId))
      .then((r) => r.json())
      .then((json) => setOrgName(json?.data?.organization?.name ?? ''))
      .catch(() => setOrgName(''));
  }, [isOpen, organizationId]);

  const selectedGroup = groups?.find((g) => g.organization_id === groupId);

  const addExpense = () =>
    setExpenses((prev) => [...prev, { nombre: '', monto: 0 }]);

  const removeExpense = (idx: number) =>
    setExpenses((prev) => prev.filter((_, i) => i !== idx));

  const updateExpense = (idx: number, field: keyof ExpenseItem, value: string | number) =>
    setExpenses((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e))
    );

  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.monto) || 0), 0);

  const handlePrint = async () => {
    try {
      setPrinting(true);

      if (mode === 'day') {
        const data = await fetchCurrentAccount(date, groupId || null);
        if (!data.length) {
          toast.error('Sin datos para esa fecha.');
          return;
        }
        await printDailyTotalsTicket({
          data,
          date,
          orgName,
          groupName: selectedGroup?.name,
          expenses: expenses.filter((e) => e.nombre && e.monto > 0),
        });
        toast.success('Ticket generado.');
      } else {
        const dailyTotals = await fetchCurrentAccountTotals(
          dateFrom,
          dateTo,
          groupId || null
        );
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
                <SelectItem value="">Todos los grupos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.organization_id} value={g.organization_id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Fecha (modo día) */}
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

            {/* Gastos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Gastos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addExpense}>
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Agregar
                </Button>
              </div>

              {expenses.map((exp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Nombre del gasto"
                    value={exp.nombre}
                    onChange={(e) => updateExpense(idx, 'nombre', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Monto"
                    value={exp.monto || ''}
                    onChange={(e) => updateExpense(idx, 'monto', Number(e.target.value))}
                    className="w-28"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExpense(idx)}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {expenses.length > 0 && (
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

        {/* Rango de fechas */}
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
