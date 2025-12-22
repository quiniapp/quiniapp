import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { IconButton } from '../button/IconButton';
import { ILotteryEntityFront } from '@helper/types/lottery.type';

interface GenerateWinnersModalProps {
  isOpen: boolean;
  schedule?: IScheduleEntityFront;
  lottery?: ILotteryEntityFront;
  onClose: VoidFunction;
  onClick: VoidFunction;
  isPendingDelete: boolean;
  date: string
}

const DeleteResultsModal = ({
  isOpen,
  schedule,
  lottery,
  onClose,
  onClick,
  isPendingDelete,
  date
}: GenerateWinnersModalProps) => {
  return (
    <Modal
      title="Borrar resultados"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] md:!max-w-[600px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <FlexCol className="gap-3 sm:gap-4 w-full px-2 sm:px-4">
        <Label className="text-sm sm:text-base">Borrar resultados para el dia {date}</Label>
        <Label className="text-sm sm:text-base">Turno {schedule?.name} </Label>
        <Label className="text-sm sm:text-base">Loteria {lottery?.name} </Label>
        <IconButton
          label={isPendingDelete ? 'Borrando...' : 'Borrar resultados'}
          variant="destructive"
          onClick={() => onClick()}
          disabled={isPendingDelete}
          className="w-full"
        />
      </FlexCol>
    </Modal>
  );
};

export default DeleteResultsModal;
