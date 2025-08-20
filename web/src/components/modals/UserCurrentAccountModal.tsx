import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Label } from '../ui/label';
import { ICurrentAccountEntityFront } from '../../../../helper/types/current_account.type';

interface UserCurrentAccountModalProps {
  isOpen: boolean;
  onClose: VoidFunction
  currentAccount?: ICurrentAccountEntityFront
}

const UserCurrentAccountModal = ({ isOpen, onClose, currentAccount }: UserCurrentAccountModalProps) => {
  if (!isOpen) return null;
  return (
    <Modal
      title={`Liquidar ${currentAccount?.user_name} del día ${currentAccount?.date}`}
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <FlexCol className="items-center pt-2">
        <Label className="text-white text-center">Carga de jugadas no disponible</Label>
      </FlexCol>
    </Modal>
  );
};

export default UserCurrentAccountModal;
