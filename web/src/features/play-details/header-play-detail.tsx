import { PrinterIcon, Repeat2Icon } from 'lucide-react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import RepeatTicketModal from '@/components/modals/repeat-ticket-modal.tsx';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { useModalContext } from '@/providers/modal-provider';
import { IUserEntityFront, USER_TYPE } from '../../../../helper/types/user.type';
import { useUsersByNumber } from '@/hooks/fetchs/users/useUsersByNumber';
import { useEffect, useState } from 'react';

interface HeaderPlayDetailProps {
  setCashier: (searchCashier: IUserEntityFront) => void;
}

const HeaderPlayDetail = ({ setCashier }: HeaderPlayDetailProps) => {
  const getRole = localStorage.getItem('role');
 const [userNumber, setUserNumber] = useState<number | undefined>(undefined);
    const { data } = useUsersByNumber(userNumber);

    const handleSearch = (search: string) => {
      const parsed = parseInt(search);
      setUserNumber(isNaN(parsed) ? undefined : parsed);
    };
    useEffect(() => {
      if (data) {
        setCashier(data?.data?.users?.[0]);
      }
    }, [userNumber, data]);

  const { isOpen, openModal, closeModal } = useModalContext();
  return (
    <HeaderSection title={' Realizar Jugadas'}>
      {isOpen && (
        <RepeatTicketModal isOpen={isOpen} title={'Repetir Ticket'} onClose={closeModal} />
      )}
      <Flex className={'h-[56px] items-center   justify-end w-full'}>
        <Flex className={'gap-8'}>
        {getRole !== USER_TYPE.CASHIER && (
          <Flex className={'items-center justify-center gap-4'}>
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
              {data?.data?.users?.length && (
                <Label htmlFor={'user'}> {data?.data?.users?.[0].name}</Label>
              )}
            </div>
          </Flex>
        )}
        <Box className={'grid grid-cols-3 space-x-5'}>
          <Button type={'button'} onClick={openModal}>
            <Repeat2Icon />
            <Typography variant={'small'}>Repetir Ticker</Typography>
          </Button>
          <Button type={'button'} variant={'outline'}>
            <PrinterIcon />
            <Typography variant={'small'}>Reimprimir Anterior</Typography>
          </Button>
          <Button type={'button'} className={''} variant={'outline'}>
            Cancelar Ticket{' '}
          </Button>
        </Box>
      </Flex>
      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
