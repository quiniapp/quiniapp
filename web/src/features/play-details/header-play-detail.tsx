import { PrinterIcon, Repeat2Icon } from 'lucide-react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import RepeatTicketModal from '@/components/modals/repeat-ticket-modal.tsx';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { useModalContext } from '@/providers/modal-provider';

const HeaderPlayDetail = () => {
  const getRole = localStorage.getItem('role');
  const HeaderAgentRoleSelected = ({ role }: { role: string }) => {
    if (role === 'superadmin') {
      return (
        <Flex className={'w-full   gap-4'}>
          <Flex className={'items-center justify-center gap-4'}>
            <Label htmlFor={'user'}> Usuario</Label>
            <Input type={'text'} id={'user'} name={'user'} className={'max-w-[100px]'} />
          </Flex>
          <Flex className={'items-center justify-center gap-4'}>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Fruits</SelectLabel>
                  <SelectItem value="apple">Select 1</SelectItem>
                  <SelectItem value="banana">Select +</SelectItem>
                  <SelectItem value="blueberry">Select +</SelectItem>
                  <SelectItem value="grapes">Select +</SelectItem>
                  <SelectItem value="pineapple">Select +</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Flex>
        </Flex>
      );
    } else {
      return (
        <Flex className={'gap-8'}>
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
      );
    }
  };

  const { isOpen, openModal, closeModal } = useModalContext();
  return (
    <HeaderSection title={' Realizar Jugadas'}>
      {isOpen && (
        <RepeatTicketModal isOpen={isOpen} title={'Repetir Ticket'} onClose={closeModal} />
      )}
      <Flex className={'h-[56px] items-center   justify-end w-full'}>
        <HeaderAgentRoleSelected role={`${getRole}`} />
      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
