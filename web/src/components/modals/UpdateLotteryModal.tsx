import { useState, useEffect } from 'react';
import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
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
  const [order, setOrder] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (lottery) {
      setName(lottery.name);
      setOrder(lottery.order);
      setActive(lottery.active);
    }
  }, [lottery]);

  const { mutate: updateLottery, isPending } = useUpdateLottery({
    onSuccess: () => {
      toast.success('Lotería actualizada exitosamente');
      onClose();
    },
    onError: (error) => {
      toast.error(`Error al actualizar lotería: ${error.message}`);
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
        order,
        active,
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

          <Flex className="items-center justify-between py-2">
            <FlexCol className="gap-1">
              <Label htmlFor="active">Estado</Label>
              <p className="text-xs text-muted-foreground">
                {active ? 'Lotería activa' : 'Lotería inactiva'}
              </p>
            </FlexCol>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
              disabled={isPending}
            />
          </Flex>

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
