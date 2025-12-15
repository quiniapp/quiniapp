import { useState, useEffect } from 'react';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { IconButton } from '../button/IconButton';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { toast } from 'react-hot-toast';
import { useUpdateSchedule } from '@/hooks/mutations/schedule/useUpdateSchedule';

interface UpdateScheduleModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  schedule: IScheduleEntityFront | null;
}

const UpdateScheduleModal = ({ isOpen, onClose, schedule }: UpdateScheduleModalProps) => {
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setTime(schedule.time);
      setActive(schedule.active);
    }
  }, [schedule]);

  const { mutate: updateSchedule, isPending } = useUpdateSchedule({
    onSuccess: () => {
      toast.success('Turno actualizado exitosamente');
      onClose();
    },
    onError: (error) => {
      toast.error(`Error al actualizar turno: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;

    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!time.trim()) {
      toast.error('La hora es requerida');
      return;
    }

    updateSchedule({
      schedule_id: schedule.schedule_id,
      updateSchedule: {
        name: name.trim(),
        time: time.trim(),
        active,
      },
    });
  };

  if (!schedule) return null;

  return (
    <Modal
      title="Editar Turno"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <form onSubmit={handleSubmit} className="w-full px-4">
        <FlexCol className="gap-4 w-full">
          <FlexCol className="gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Vespertina"
              autoFocus
              disabled={isPending}
            />
          </FlexCol>

          <FlexCol className="gap-2">
            <Label htmlFor="time">Hora</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Hora del sorteo (se ordena automáticamente por hora)
            </p>
          </FlexCol>

          <Flex className="items-center justify-between py-2">
            <FlexCol className="gap-1">
              <Label htmlFor="active">Estado</Label>
              <p className="text-xs text-muted-foreground">
                {active ? 'Turno activo' : 'Turno inactivo'}
              </p>
            </FlexCol>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
              disabled={isPending}
            />
          </Flex>

          <Flex className="gap-2 pt-4">
            <IconButton
              type="button"
              label="Cancelar"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="w-full"
            />
            <IconButton
              type="submit"
              label={isPending ? 'Guardando...' : 'Guardar'}
              disabled={isPending}
              className="w-full"
            />
          </Flex>
        </FlexCol>
      </form>
    </Modal>
  );
};

export default UpdateScheduleModal;
