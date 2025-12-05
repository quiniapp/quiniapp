import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';

interface ResetPartialModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  onClick: VoidFunction;
}

const ResetPartialModal = ({ isOpen, onClose, onClick }: ResetPartialModalProps) => {
  return (
    <Modal
      title="Resetear suma parcial"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] md:!max-w-[600px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <FlexCol className="items-center pt-2 gap-4 px-2 sm:px-4 justify-center">
        <Label className="text-center text-sm sm:text-base">
          ¿Estás seguro de que quieres resetear la suma parcial?
        </Label>
        <Flex className="gap-2 sm:gap-3 w-full justify-center">
          <IconButton
            label="Si"
            variant="success"
            onClick={() => onClick()}
            className="min-w-14"
          />
          <IconButton
            label="No"
            variant="destructive"
            onClick={() => onClose()}
            className="min-w-14"
          />
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default ResetPartialModal;
