import { Flex } from '@/components/flex';

import HeaderSection from '@/components/header-section';

import Box from '@/components/box';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/typography';
import { PrinterIcon, Repeat2Icon } from 'lucide-react';

const HeaderPlayDetail = () => {
  return (
    <HeaderSection title={' Realizar Jugadas'}>
      <Flex className={'h-[56px] items-center   justify-end w-full'}>
        <form>
          <Flex className={'gap-8'}>
            <Box className={'grid grid-cols-3 space-x-5'}>
              <Button type={'button'}>
                <Repeat2Icon />
                <Typography variant={'small'}>Repetir Ticker</Typography>
              </Button>
              <Button type={'button'} className={'bg-[--primary-800]'}>
                <PrinterIcon />
                <Typography variant={'small'}>Reimprimir Anterior</Typography>
              </Button>
              <Button type={'button'} className={''} variant={'outline'}>Cancelar Ticket </Button>
            </Box>

          </Flex>
        </form>
      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
