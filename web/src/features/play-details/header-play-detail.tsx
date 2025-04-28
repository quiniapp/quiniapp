import { Flex } from '@/components/flex';

import HeaderSection from '@/components/header-section';

import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/typography';
import { PrinterIcon, Repeat2Icon } from 'lucide-react';


import RepeatTicketModal from '@/components/modals/repeat-ticket-modal.tsx';
import { useModalContext } from '@/providers/modal-provider'


const HeaderPlayDetail = () => {
  const { isOpen, openModal, closeModal } = useModalContext();
  return (
    <HeaderSection title={' Realizar Jugadas'}>
      { isOpen && (<RepeatTicketModal isOpen={isOpen} title={'Repetir Ticket'} onClose={closeModal} />)}
      <Flex className={'h-[56px] items-center   justify-end w-full'}>

          <Flex className={'gap-8'}>
            <Box className={'grid grid-cols-3 space-x-5'}>
              <Button type={'button'} onClick={openModal}>
                <Repeat2Icon />
                <Typography variant={'small'}>Repetir Ticker</Typography>
              </Button>
              <Button type={'button'} variant={'outline'} >
                <PrinterIcon />
                <Typography variant={'small'}>Reimprimir Anterior</Typography>
              </Button>
              <Button type={'button'} className={''} variant={'outline'}>Cancelar Ticket </Button>
            </Box>
          </Flex>

      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
