import { useState } from 'react';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { IconButton } from '../button/IconButton';
import { toast } from 'react-hot-toast';
import { useCreateSchedule } from '@/hooks/mutations/schedule/useCreateSchedule';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
}

const CreateScheduleModal = ({ isOpen, onClose }: CreateScheduleModalProps) => {
  const [name, setName] = useState('');
  const [time, setTime] = useState('');

  const { mutate: createSchedule, isPending } = useCreateSchedule({
    onSuccess: () => {
      toast.success('Turno creado exitosamente');
      setName('');
      setTime('');
      onClose();
    },
    onError: (error) => {
      toast.error(`Error al crear turno: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!time.trim()) {
      toast.error('La hora es requerida');
      return;
    }
    createSchedule({ name: name.trim(), time: time.trim().slice(0,5), active: true });
  };

  const handleClose = () => {
    setName('');
    setTime('');
    onClose();
  };

  return (
    <Modal
      title="Crear Turno"
      isOpen={isOpen}
      onClose={handleClose}
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

          <Flex className="gap-2 pt-4">
            <IconButton
              type="button"
              label="Cancelar"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="w-full"
            />
            <IconButton
              type="submit"
              label={isPending ? 'Creando...' : 'Crear'}
              disabled={isPending}
              className="w-full"
            />
          </Flex>
        </FlexCol>
      </form>
    </Modal>
  );
};

export default CreateScheduleModal;
