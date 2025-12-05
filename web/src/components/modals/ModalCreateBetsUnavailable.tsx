import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Label } from '../ui/label';

interface ModalCreateBetsUnavailable {
  isOpen: boolean;
}

const ModalCreateBetsUnavailable = ({ isOpen }: ModalCreateBetsUnavailable) => {
  return (
    <Modal
      title="Carga de jugadas no disponible"
      isOpen={isOpen}
      onClose={() => {}}
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <FlexCol className="items-center pt-2">
        <Label className="text-center">Carga de jugadas no disponible</Label>
      </FlexCol>
    </Modal>
  );
};

export default ModalCreateBetsUnavailable;
