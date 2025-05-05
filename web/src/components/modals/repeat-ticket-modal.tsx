import Modal from '@/components/modals/custom-modal.tsx';
import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Typography } from '@/components/typography';

import { QuinielaFieldset } from '@/features/play-details/quiniela-fieldset.tsx';
import { SearchIcon } from 'lucide-react';

interface BasicModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
}

const RepeatTicketModal = ({ isOpen, title, onClose }: BasicModalProps) => {
  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      className="!max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
      <form className={'flex flex-col gap-6'}>
        <Box className={'grid grid-cols-[1fr_3fr_1fr_5fr] items-center gap-5'}>
          <Flex className={'justify-end'}>
            <Typography variant={'small'}> Ticket N°: </Typography>
          </Flex>
          <Input type={'text'} placeholder={'1234567'} />
          <Button type={'button'} className={'bg-black border'}>
            {' '}
            <SearchIcon /> Buscar
          </Button>
        </Box>
        <Box className={'grid grid-cols-3 py-6 gap-8'}>
          <FlexCol className={'gap-8'}>
            <QuinielaFieldset legend={'Turno 1'} namePrefix={'tone'} />
            <QuinielaFieldset legend={'Verpertina (18:05 hs)'} namePrefix={'vep-1'} />
            <Button variant={'outline'} type={'button'} className={'  flex justify-center'}>
              Selecionar todas
            </Button>
          </FlexCol>

          <FlexCol className={'gap-8'}>
            <QuinielaFieldset legend={'Primera (12:05 hs)'} namePrefix={'prime'} />
            <QuinielaFieldset legend={'Noche (21:05 hs)'} namePrefix={'noite-1'} />
            <Button variant={'outline'} type={'button'} className={' flex justify-center'}>
              Modificar monto
            </Button>
          </FlexCol>
          <FlexCol className={'gap-8'}>
            <QuinielaFieldset legend={'Matutina (15:05 hs'} namePrefix={'matu'} />
            <QuinielaFieldset legend={'Turno 6'} namePrefix={'turn-6'} />
            <Button variant={'outline'} type={'reset'} className={'   flex justify-center'}>
              Quitar todaso
            </Button>
          </FlexCol>
        </Box>
        <Box className={'grid grid-cols-[2fr_1fr] items-center'}>
          <Box>Monto total: </Box>
          <Flex className={'space-x-10'}>
            <Box>
              <Button variant={'default'}>AGREGAR JUGADAS</Button>
            </Box>
            <Box>
              <Button variant={'outline'} className={'bg-black'}>
                {' '}
                CANCELAR
              </Button>
            </Box>
          </Flex>
        </Box>
      </form>
    </Modal>
  );
};

export default RepeatTicketModal;
