import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { useDeleteLottery } from '@/hooks/mutations/lottery/useDeleteLottery';

interface DeleteLotteryModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  lottery: ILotteryEntityFront | null;
}

const DeleteLotteryModal = ({ isOpen, onClose, lottery }: DeleteLotteryModalProps) => {
  const { mutate: deleteLottery, isPending } = useDeleteLottery(undefined, {
    onSuccess: () => {
      onClose();
    },
  });

  const handleDelete = () => {
    if (!lottery) return;
    deleteLottery(lottery.lottery_id);
  };

  if (!lottery) return null;

  return (
    <Modal
      title="Eliminar Lotería"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <FlexCol className="items-center pt-2 gap-4 px-4 w-full">
        <Label className="text-center text-sm sm:text-base">
          ¿Estás seguro de que quieres eliminar esta lotería?
        </Label>
        <Flex className="justify-center">
          <Label className="text-center font-semibold text-sm sm:text-base">{lottery.name}</Label>
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

export default DeleteLotteryModal;
