import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { toast } from 'react-hot-toast';
import { useDeleteSchedule } from '@/hooks/mutations/schedule/useDeleteSchedule';

interface DeleteScheduleModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  schedule: IScheduleEntityFront | null;
}

const DeleteScheduleModal = ({ isOpen, onClose, schedule }: DeleteScheduleModalProps) => {
  const { mutate: deleteSchedule, isPending } = useDeleteSchedule({
    onSuccess: () => {
      toast.success('Turno eliminado exitosamente');
      onClose();
    },
    onError: (error) => {
      toast.error(`Error al eliminar turno: ${error.message}`);
    },
  });

  const handleDelete = () => {
    if (!schedule) return;
    deleteSchedule(schedule.schedule_id);
  };

  if (!schedule) return null;

  return (
    <Modal
      title="Eliminar Turno"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <FlexCol className="items-center pt-2 gap-4 px-4 w-full">
        <Label className="text-center text-sm sm:text-base">
          ¿Estás seguro de que quieres eliminar este turno?
        </Label>
        <Flex className="justify-center flex-col items-center gap-1">
          <Label className="text-center font-semibold text-sm sm:text-base">
            {schedule.name}
          </Label>
          <Label className="text-center text-xs text-muted-foreground">
            Hora: {schedule.time}
          </Label>
        </Flex>
        <Label className="text-center text-xs sm:text-sm text-muted-foreground">
          Esta acción no se puede deshacer.
        </Label>
        <Flex className="gap-2 w-full pt-4">
          <IconButton
            label="Cancelar"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="w-full"
          />
          <IconButton
            label={isPending ? 'Eliminando...' : 'Eliminar'}
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full"
          />
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default DeleteScheduleModal;
