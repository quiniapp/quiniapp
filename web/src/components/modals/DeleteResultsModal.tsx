import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { Button } from '../ui/button';
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
      className="flex flex-col items-center w-fit !max-w-[980px]  m-auto bg-[#060813] pt-[36px]"
    >
      <FlexCol className='gap-3 w-fit'>
        <Label>Borrar resultados para el dia {date}</Label>
        <Label>Turno {schedule?.name} </Label>
        <Label>Loteria {lottery?.name} </Label>
        <Button
          variant={'success'}
          className="  hover:bg-green-700 text-white"
          onClick={() => onClick()}
        >
          {isPendingDelete ? 'Borrando...' : 'Borrar resultados'}
        </Button>
      </FlexCol>
    </Modal>
  );
};

export default DeleteResultsModal;
