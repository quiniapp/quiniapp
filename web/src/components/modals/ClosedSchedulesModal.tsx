import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';
import { IScheduleEntityFront } from '@helper/types/schedule.type';

interface ClosedSchedulesModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  onConfirm: VoidFunction;
  closedSchedules: IScheduleEntityFront[];
}

const ClosedSchedulesModal = ({
  isOpen,
  onClose,
  onConfirm,
  closedSchedules,
}: ClosedSchedulesModalProps) => {
  return (
    <Modal
      title="Turnos cerrados o por cerrar"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] md:!max-w-[600px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <FlexCol className="items-center pt-2 gap-4 px-2 sm:px-4 justify-center">
        <Label className="text-center text-sm sm:text-base">
          Los siguientes turnos ya cerraron o están por cerrar (menos de 10 minutos) y serán
          eliminados de las jugadas:
        </Label>
        <FlexCol className="w-full gap-2 max-h-[200px] overflow-y-auto">
          {closedSchedules.map((schedule) => (
            <div
              key={schedule.schedule_id}
              className="text-sm sm:text-base text-center bg-card p-2 rounded"
            >
              {schedule.name} [{schedule.time.slice(0, 5)}]
            </div>
          ))}
        </FlexCol>
        <Label className="text-center text-sm sm:text-base text-muted-foreground">
          ¿Deseas continuar con el cierre del ticket?
        </Label>
        <Flex className="gap-2 sm:gap-3 w-full justify-center">
          <IconButton
            label="Continuar"
            variant="success"
            onClick={onConfirm}
            className="min-w-20"
          />
          <IconButton label="Cancelar" variant="destructive" onClick={onClose} className="min-w-20" />
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default ClosedSchedulesModal;
