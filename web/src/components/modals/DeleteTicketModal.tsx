import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

interface DeleteTicketModalProps {
  isOpen: boolean;
  ticketNumber?: string;
  onClose: VoidFunction;
  onClick: VoidFunction;
  isPendingDelete: boolean;
}

const DeleteTicketModal = ({
  isOpen,
  ticketNumber,
  onClose,
  onClick,
  isPendingDelete,
}: DeleteTicketModalProps) => {
  return (
    <Modal
      title="Eliminar Ticket"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center w-fit !max-w-[980px]  m-auto bg-[#060813] pt-[36px]"
    >
      <FlexCol className='gap-3 w-fit'>
        <Label>¿Estás seguro que deseas eliminar el ticket?</Label>
        <Label className='font-bold'>Ticket N°: {ticketNumber}</Label>
        <Label className='text-sm text-muted-foreground'>Esta acción no se puede deshacer.</Label>
        <FlexCol className='gap-2 mt-4'>
          <Button
            variant={'destructive'}
            className="hover:bg-red-700 text-white"
            onClick={() => onClick()}
            disabled={isPendingDelete}
          >
            {isPendingDelete ? 'Eliminando...' : 'Eliminar ticket'}
          </Button>
          <Button
            variant={'outline'}
            onClick={onClose}
            disabled={isPendingDelete}
          >
            Cancelar
          </Button>
        </FlexCol>
      </FlexCol>
    </Modal>
  );
};

export default DeleteTicketModal;
