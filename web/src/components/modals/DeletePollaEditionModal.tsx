import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';
import { IPollaEditionEntityFront } from '@helper/types/polla-edition.type';
import { useDeletePollaEdition } from '@/hooks/mutations/polla-edition/useDeletePollaEdition';

interface DeletePollaEditionModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  edition: IPollaEditionEntityFront | null;
}

const DeletePollaEditionModal = ({ isOpen, onClose, edition }: DeletePollaEditionModalProps) => {
  const { mutate: deleteEdition, isPending } = useDeletePollaEdition(undefined, {
    onSuccess: () => onClose(),
  });

  const handleDelete = () => {
    if (!edition) return;
    deleteEdition(edition.polla_edition_id);
  };

  if (!edition) return null;

  return (
    <Modal
      title="Eliminar Edición de Polla"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <FlexCol className="items-center pt-2 gap-4 px-4 w-full">
        <Label className="text-center text-sm sm:text-base">
          ¿Estás seguro de que quieres eliminar esta edición de Polla?
        </Label>
        <Label className="text-center text-xs sm:text-sm text-muted-foreground">
          Esta acción no se puede deshacer. Las jugadas ya cargadas no se ven afectadas.
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

export default DeletePollaEditionModal;
