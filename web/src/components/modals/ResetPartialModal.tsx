import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '@radix-ui/react-label';
import { Button } from '../ui/button';

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
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <FlexCol className="items-center pt-2">
        <Label className="text-white text-center">
          ¿Estás seguro de que quieres resetear la suma parcial?
        </Label>
        <Flex className="gap-3">
          <Button
            variant={'success'}
            className="  hover:bg-green-700 text-white w-3"
            onClick={() => onClick()}
          >
            Si
          </Button>
          <Button
            variant={'destructive'}
            className="  hover:bg-blue-700 text-white w-3"
            onClick={() => onClose()}
          >
            No
          </Button>
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default ResetPartialModal;
