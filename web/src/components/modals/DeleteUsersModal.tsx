import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { IUserEntityFront } from '@helper/types/user.type';


interface DeleteUsersModalProps {
  isOpen: boolean;
  user?: IUserEntityFront;
  onClose: VoidFunction;
  onClick: (id:string)=>void;
  isPending: boolean;
}

const DeleteUsersModal = ({ isOpen, onClose, onClick,user, isPending }: DeleteUsersModalProps) => {
  return (
    <Modal
      title="Eliminar usuario"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <FlexCol className="items-center pt-2">
        <Label className="text-white text-center">
          ¿Estás seguro de que quieres eliminar a este usuario?
        </Label>
        <Flex>
            <Label className="text-white text-center">
                {`${user?.name} - ${user?.number}`}
            </Label>
        </Flex>
        <Label className="text-white text-center">
          Esta acción no se puede deshacer.
        </Label>
      </FlexCol>
      <FlexCol className="items-center pt-2">
        <Button
          variant={'success'}
          className="  hover:bg-green-700 text-white"
          onClick={() => onClick(user?.user_id ?? '')}
        >
          {isPending ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </FlexCol>
    </Modal>
  );
};

export default DeleteUsersModal;
