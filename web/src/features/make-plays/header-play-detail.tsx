import { PrinterIcon, Repeat2Icon } from 'lucide-react';
import React, { Suspense, useState } from 'react';

import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';

import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { makeTicketPdf } from '@/functions/makeTicket';
import { IBetTable } from '@helper/request/ticket.response';
import { useGetTicketsNumber } from '@/hooks/fetchs/tickets/useGetTicketNumber';

// 👇 Lazy import del modal (se carga sólo cuando se renderiza)
const RepeatTicketModal = React.lazy(() => import('@/components/modals/repeat-ticket-modal.tsx'));

interface HeaderPlayDetailProps {
  cashier?: IUserEntityFront;
  userNumber?: number;
  setUserNumber: React.Dispatch<React.SetStateAction<number | undefined>>;
  handleRecreateBet: (values: IBetTable[]) => void;
  handleEditTicket: (ticket_id: string) => void;

  setTotalAmount: React.Dispatch<React.SetStateAction<number>>;
  setPartialAmount: React.Dispatch<React.SetStateAction<number>>;
}

const HeaderPlayDetail = ({
  cashier,
  userNumber,
  setUserNumber,
  handleRecreateBet,
  handleEditTicket,
}: HeaderPlayDetailProps) => {
  const { role } = useAuth();

  // 👇 Estado local para abrir/cerrar el modal
  const [isRepeatOpen, setIsRepeatOpen] = useState(false);

  const openRepeatModal = () => setIsRepeatOpen(true);
  const closeRepeatModal = () => setIsRepeatOpen(false);

  const handleSearch = (search: string) => {
    const parsed = parseInt(search);
    setUserNumber(isNaN(parsed) ? undefined : parsed);
  };

  const handleRePrimtLast = () => {
    const lastTicketStr = localStorage.getItem('lastTicket');
    if (!lastTicketStr) {
      toast.error('No hay ticket guardado para reimprimir');
      return;
    }
    const lastTicket = JSON.parse(lastTicketStr);
    makeTicketPdf(lastTicket);
  };
  const { data: tickets } = useGetTicketsNumber({
    user_id: cashier?.user_id,
    date: dayjs().format('YYYY-MM-DD'),
    enabled: !!cashier?.user_id,
  });

  const handleSelectTicket = (value: string) => {
    if (tickets?.length) {
      handleEditTicket(value);
    }
  };

  return (
    <HeaderSection title={' Realizar Jugadas'}>
      {role !== USER_TYPE.CASHIER && (
        <Flex className={'flex-col sm:flex-row items-center justify-center gap-4 sm:px-3'}>
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
          <Flex className={'flex-col sm:flex-row items-center justify-center gap-4 sm:px-3'}>
            <Label htmlFor={'user'}> Ticket</Label>
            <Select onValueChange={(value) => handleSelectTicket(value)} value={''}>
              <SelectTrigger className="w-full border-dark-lighter">
                <SelectValue placeholder="Seleccione uno" />
              </SelectTrigger>
              <SelectContent>
                {cashier &&
                  tickets?.map((ticket) => (
                    <SelectItem key={ticket.ticket_id} value={ticket.ticket_id}>
                      {ticket.ticket_number}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Flex>
        </Flex>
      )}

      {role === USER_TYPE.CASHIER && (
        <Flex className="flex-row w-full flex-wrap justify-center  sm:justify-end gap-3">
          <Button
            type="button"
            onClick={openRepeatModal}
            className="h-7 px-2 text-[10px] gap-1 sm:h-8 sm:px-3 sm:text-xs sm:w-fit"
          >
            <Repeat2Icon className="hidden sm:flex w-3 h-3" />
            <Typography className="text-[10px] sm:text-xs" variant="small">
              Repetir Ticket
            </Typography>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleRePrimtLast}
            className="h-7 px-2 text-[10px] gap-1 sm:h-8 sm:px-3 sm:text-xs sm:w-fit"
          >
            <PrinterIcon className="hidden sm:flex w-3 h-3" />
            <Typography className="text-[10px] sm:text-xs" variant="small">
              Reimprimir Anterior
            </Typography>
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="h-7 px-2 text-[10px] gap-1 sm:h-8 sm:px-3 sm:text-xs sm:w-fit"
          >
            <Typography className="text-[10px] sm:text-xs" variant="small">
              Cancelar Ticket
            </Typography>
          </Button>
        </Flex>
      )}

      {isRepeatOpen && (
        <Suspense fallback={<div className="p-4 text-sm text-slate-300">Cargando…</div>}>
          <RepeatTicketModal
            isOpen={isRepeatOpen}
            title={'Repetir Ticket'}
            onClose={closeRepeatModal}
            handleRecreateBet={(values) => {
              handleRecreateBet(values);

            }}
          />
        </Suspense>
      )}
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
