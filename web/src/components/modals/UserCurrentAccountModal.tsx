import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { ICurrentAccountEntityFront } from '../../../../helper/types/current_account.type';
import dayjs from 'dayjs';
import LabelInput from '../molecules/LabelInput';
import { useBets } from '@/hooks/fetchs/plays/useBets';

interface UserCurrentAccountModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
  currentAccount?: ICurrentAccountEntityFront;
}

const UserCurrentAccountModal = ({
  isOpen,
  onClose,
  currentAccount,
}: UserCurrentAccountModalProps) => {
  const { data: bets } = useBets({
    date: currentAccount?.date ?? '',
    cashier_id: currentAccount?.user_id ?? '',
    winners: 'true',
  });

  console.log(bets);
  if (!isOpen) return null;

  return (
    <Modal
      title={`Liquidar ${currentAccount?.user_name}-${currentAccount?.user_number} del día ${dayjs(currentAccount?.date).format('DD-MM-YYYY')}`}
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <Flex className="justify-center gap-1 sm:gap-3">
        <FlexCol className="items-between pt-2">
          <LabelInput title="Pase" value="" />
          <LabelInput title={`Comision ${currentAccount?.cashier_commission}%`} value="" />
          <LabelInput title="Aciertos" value="" />
          <LabelInput title="Reclamos" value="" />
          <LabelInput title="Gastos" value="" />
          <LabelInput title="Deja" value="" />
        </FlexCol>
        <FlexCol className="items-between pt-2">
          <LabelInput title="Saldo Anterior" value="" />
          <LabelInput title="Cobro al pasador" value="" />
          <LabelInput title="Pago al asador" value="" />
          <LabelInput title="Arrastre anterior" value="" />
          <LabelInput title="Arrastre nuevo" value="" />
          <LabelInput title="Deje" value="" />
        </FlexCol>
      </Flex>
    </Modal>
  );
};

export default UserCurrentAccountModal;
