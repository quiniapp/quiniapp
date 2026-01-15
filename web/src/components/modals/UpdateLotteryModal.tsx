import { useState, useEffect } from 'react';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { IconButton } from '../button/IconButton';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { toast } from 'react-hot-toast';
import { useUpdateLottery } from '@/hooks/mutations/lottery/useUpdateLottery';

interface UpdateLotteryModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  lottery: ILotteryEntityFront | null;
}

const UpdateLotteryModal = ({ isOpen, onClose, lottery }: UpdateLotteryModalProps) => {
  const [name, setName] = useState('');
  // Display human-friendly position (1-indexed)

  useEffect(() => {
    if (lottery) {
      setName(lottery.name);
    }
  }, [lottery]);

  const { mutate: updateLottery, isPending } = useUpdateLottery(undefined, {
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lottery) return;

    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    updateLottery({
      lottery_id: lottery.lottery_id,
      updateLottery: {
        name: name.trim(),

      },
    });
  };

  if (!lottery) return null;

  return (
    <Modal
      title="Editar Lotería"
      isOpen={isOpen}
      onClose={onClose}
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



          <Flex className="gap-2 pt-4">
            <IconButton
              type="button"
              label="Cancelar"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="w-full"
            />
            <IconButton
              type="submit"
              label={isPending ? 'Guardando...' : 'Guardar'}
              disabled={isPending}
              className="w-full"
            />
          </Flex>
        </FlexCol>
      </form>
    </Modal>
  );
};

export default UpdateLotteryModal;
