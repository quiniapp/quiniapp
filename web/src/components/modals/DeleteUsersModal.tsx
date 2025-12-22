import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';
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
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] md:!max-w-[600px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <FlexCol className="items-center pt-2 gap-4 px-2 sm:px-4 w-full">
        <Label className="text-center text-sm sm:text-base">
          ¿Estás seguro de que quieres eliminar a este usuario?
        </Label>
        <Flex className="justify-center">
            <Label className="text-center font-semibold text-sm sm:text-base">
                {`${user?.name} - ${user?.number}`}
            </Label>
        </Flex>
        <Label className="text-center text-xs sm:text-sm text-muted-foreground">
          Esta acción no se puede deshacer.
        </Label>
        <IconButton
          label={isPending ? 'Eliminando...' : 'Eliminar'}
          variant="destructive"
          onClick={() => onClick(user?.user_id ?? '')}
          disabled={isPending}
          className="w-full"
        />
      </FlexCol>
    </Modal>
  );
};

export default DeleteUsersModal;
