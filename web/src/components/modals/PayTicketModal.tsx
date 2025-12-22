import Modal from './custom-modal';
import { FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';

interface PayTicketModalProps {
  isOpen: boolean;
  ticketNumber?: string;
  onClose: VoidFunction;
  onClick: VoidFunction;
  isPendingDelete: boolean;
}

const PayTicketModal = ({
  isOpen,
  ticketNumber,
  onClose,
  onClick,
  isPendingDelete,
}: PayTicketModalProps) => {
  return (
    <Modal
      title="Pagar ticket"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] md:!max-w-[600px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <FlexCol className="gap-3 sm:gap-4 w-full px-2 sm:px-4">
        <Label className="text-sm sm:text-base">¿Estás seguro que deseas pagar el ticket?</Label>
        <Label className="font-bold text-sm sm:text-base">Ticket N°: {ticketNumber}</Label>
        <Label className="text-xs sm:text-sm text-muted-foreground">Esta acción no se puede deshacer.</Label>
        <FlexCol className="gap-2 mt-2 sm:mt-4 w-full">
          <IconButton
            label={isPendingDelete ? 'Pagando...' : 'Pagar ticket'}
            variant="success"
            onClick={() => onClick()}
            disabled={isPendingDelete}
            className="w-full"
          />
          <IconButton
            label="Cancelar"
            variant="outline"
            onClick={onClose}
            disabled={isPendingDelete}
            className="w-full"
          />
        </FlexCol>
      </FlexCol>
    </Modal>
  );
};

export default PayTicketModal;
