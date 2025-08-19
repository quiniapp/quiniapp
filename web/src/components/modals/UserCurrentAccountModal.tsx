import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Label } from '../ui/label';

interface UserCurrentAccountModalProps {
  isOpen: boolean;
}

const UserCurrentAccountModal = ({ isOpen }: UserCurrentAccountModalProps) => {
  if (!isOpen) return null;
  return (
    <Modal
      title="Carga de jugadas no disponible"
      isOpen={isOpen}
      onClose={() => {}}
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <FlexCol className="items-center pt-2">
        <Label className="text-white text-center">Carga de jugadas no disponible</Label>
      </FlexCol>
    </Modal>
  );
};

export default UserCurrentAccountModal;
