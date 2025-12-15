import { useState } from 'react';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { IconButton } from '../button/IconButton';
import { toast } from 'react-hot-toast';
import { useCreateLottery } from '@/hooks/mutations/lottery/useCreateLottery';

interface CreateLotteryModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  nextOrder: number;
}

const CreateLotteryModal = ({ isOpen, onClose, nextOrder }: CreateLotteryModalProps) => {
  const [name, setName] = useState('');
  const [order, setOrder] = useState(nextOrder);

  const { mutate: createLottery, isPending } = useCreateLottery({
    onSuccess: () => {
      toast.success('Lotería creada exitosamente');
      setName('');
      setOrder(nextOrder);
      onClose();
    },
    onError: (error) => {
      toast.error(`Error al crear lotería: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    createLottery({ name: name.trim(), order });
  };

  const handleClose = () => {
    setName('');
    setOrder(nextOrder);
    onClose();
  };

  return (
    <Modal
      title="Crear Lotería"
      isOpen={isOpen}
      onClose={handleClose}
      className="flex flex-col items-center !max-w-[90vw] sm:!max-w-[500px] w-full m-auto bg-[#060813] pt-4 sm:pt-6"
    >
      <form onSubmit={handleSubmit} className="w-full px-4">
        <FlexCol className="gap-4 w-full">
          <FlexCol className="gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Quiniela Primera"
              autoFocus
              disabled={isPending}
            />
          </FlexCol>

          <FlexCol className="gap-2">
            <Label htmlFor="order">Orden</Label>
            <Input
              id="order"
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              min={0}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Define el orden en que aparece la lotería en la lista
            </p>
          </FlexCol>

          <Flex className="gap-2 pt-4">
            <IconButton
              type="button"
              label="Cancelar"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="w-full"
            />
            <IconButton
              type="submit"
              label={isPending ? 'Creando...' : 'Crear'}
              onClick={()=>handleSubmit}
              disabled={isPending}
              className="w-full"
            />
          </Flex>
        </FlexCol>
      </form>
    </Modal>
  );
};

export default CreateLotteryModal;
