import { PrinterIcon, Repeat2Icon } from 'lucide-react';

import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import RepeatTicketModal from '@/components/modals/repeat-ticket-modal.tsx';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { useModalContext } from '@/providers/modal-provider';
import { IUserEntityFront, USER_TYPE } from '../../../../helper/types/user.type';
import { useSessionStore } from '@/stores/sessionStore';

interface HeaderPlayDetailProps {
  cashier?: IUserEntityFront;
  userNumber?: number;
  setUserNumber: React.Dispatch<React.SetStateAction<number | undefined>>;
}

const HeaderPlayDetail = ({
  cashier,
  userNumber,
  setUserNumber,
}: HeaderPlayDetailProps) => {
  const { role } = useSessionStore();

  const handleSearch = (search: string) => {
    const parsed = parseInt(search);
    setUserNumber(isNaN(parsed) ? undefined : parsed);
  };

  const { isOpen, openModal, closeModal } = useModalContext();
  return (
    <HeaderSection title={' Realizar Jugadas'}>
      {isOpen && (
        <RepeatTicketModal isOpen={isOpen} title={'Repetir Ticket'} onClose={closeModal} />
      )}
      <Flex className={' items-center gap-2  justify-end w-full'}>
        {role !== USER_TYPE.CASHIER && (
          <Flex className={'flex-col sm:flex-row items-center justify-center gap-4 sm:px-3'}>
            <Label htmlFor={'user'}> Usuario</Label>
            <Input
              type={'text'}
              id={'user'}
              name={'user'}
              className={'max-w-[100px]'}
              value={userNumber?.toString() ?? ''}
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
            />
            <div className="w-40">
                <Label htmlFor={'user'}> {cashier?.name}</Label>
        
            </div>
          </Flex>
        )}
        <Flex className={'flex-col sm:flex-row w-fit gap-1 sm:gap-3 justify-center'}>
          <Button className="sm:w-fit p-1" type={'button'} onClick={openModal}>
            <Repeat2Icon className="w-2 h-2 sm:w-3 sm:h-3" />
            <Typography className="text-xs text-wrap" variant={'small'}>
              Repetir Ticker
            </Typography>
          </Button>
          <Button className="text-xs sm:w-fit p-1" type={'button'} variant={'outline'}>
            <PrinterIcon className="w-2 h-2 sm:w-3 sm:h-3" />
            <Typography className="text-xs text-wrap" variant={'small'}>
              Reimprimir Anterior
            </Typography>
          </Button>
          <Button type={'button'} className={'text-xs sm:w-fit p-1'} variant={'outline'}>
            Cancelar Ticket
          </Button>
        </Flex>
      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
