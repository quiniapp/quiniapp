import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import Modal from './custom-modal';
import { Button } from '@/components/ui/button';
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
import { fetchCurrentAccountDailySummary } from '@/hooks/fetchs/current-account/useGetCurrentAccountDailySummary';
import { printSubtotalsDayTicket, printSubtotalsRangeTicket } from '@/functions/printTotalsTicket';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { BACKEND_ROUTES } from '../../../routes/routes';

const ALL_GROUPS = '__all__';

interface PrintSubtotalsModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  initialDate?: string | null;
  initialGroupId?: string | null;
}

const PrintSubtotalsModal = ({
  isOpen,
  onClose,
  initialDate,
  initialGroupId,
}: PrintSubtotalsModalProps) => {
  const { organizationId, role } = useAuth();
  const { data: groups } = useGroups(organizationId, role);

  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [date, setDate] = useState<string>(initialDate ?? dayjs().format('YYYY-MM-DD'));
  const [dateFrom, setDateFrom] = useState<string>(dayjs().startOf('week').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [groupId, setGroupId] = useState<string>(initialGroupId || ALL_GROUPS);
  const [printing, setPrinting] = useState(false);
  const [orgName, setOrgName] = useState<string>('');

  const effectiveGroupId = groupId === ALL_GROUPS ? null : groupId;
  const selectedGroup = groups?.find((g) => g.organization_id === groupId);

  useEffect(() => {
    if (!isOpen || !organizationId) return;
    fetchWithAuth(BACKEND_ROUTES.organization.id(organizationId))
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setOrgName(json?.data?.organization?.name ?? ''))
      .catch(() => setOrgName(''));
  }, [isOpen, organizationId]);

  const handlePrint = async () => {
    try {
      setPrinting(true);

      if (mode === 'day') {
        const data = await fetchCurrentAccount(date, effectiveGroupId);
        if (!data.length) {
          toast.error('Sin datos para esa fecha.');
          return;
        }
        await printSubtotalsDayTicket({
          data,
          date,
          orgName,
          groupName: selectedGroup?.name,
        });
      } else {
        const dailySummary = await fetchCurrentAccountDailySummary(dateFrom, dateTo, effectiveGroupId);
        if (!dailySummary.length) {
          toast.error('Sin datos para ese rango.');
          return;
        }
        await printSubtotalsRangeTicket({
          dailySummary,
          date_from: dateFrom,
          date_to: dateTo,
          orgName,
          groupName: selectedGroup?.name,
        });
      }

      toast.success('Ticket generado.');
      onClose();
    } catch {
      toast.error('Error al generar el ticket.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imprimir Subtotales" className="max-w-md">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de reporte</Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as 'day' | 'range')}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="day" id="sub-mode-day" />
              <Label htmlFor="sub-mode-day" className="cursor-pointer">
                Día
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="range" id="sub-mode-range" />
              <Label htmlFor="sub-mode-range" className="cursor-pointer">
                Rango de fechas
              </Label>
            </div>
          </RadioGroup>
        </div>

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

        {mode === 'day' && (
          <div className="space-y-1">
            <Label>Fecha</Label>
            <SelectDayToSearch
              selectedDay={date}
              onDayChange={(d) => d && setDate(d)}
              toDate={dayjs().toDate()}
              className="w-full"
            />
          </div>
        )}

        {mode === 'range' && (
          <>
            <div className="space-y-1">
              <Label>Desde</Label>
              <SelectDayToSearch
                selectedDay={dateFrom}
                onDayChange={(d) => d && setDateFrom(d)}
                toDate={dayjs().toDate()}
                className="w-full"
              />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <SelectDayToSearch
                selectedDay={dateTo}
                onDayChange={(d) => d && setDateTo(d)}
                toDate={dayjs().toDate()}
                className="w-full"
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

export default PrintSubtotalsModal;
