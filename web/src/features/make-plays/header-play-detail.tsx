import { PrinterIcon, Repeat2Icon } from 'lucide-react';
import React, { Suspense, useEffect, useState } from 'react';

import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { IconButton } from '@/components/button/IconButton';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { USER_TYPE } from '@helper/types/user.type';

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
import { makeTicketPdf, printPdfBlob, sharePdfBlob } from '@/functions/makeTicket';
import { useGetTicketsNumber } from '@/hooks/fetchs/tickets/useGetTicketNumber';
import { usePlayDetails } from './context/MakePlaysContext';

// 👇 Lazy import del modal (se carga sólo cuando se renderiza)
const RepeatTicketModal = React.lazy(() => import('@/components/modals/repeat-ticket-modal.tsx'));

const HeaderPlayDetail = () => {
  const { cashier, userNumber, setUserNumber, handleRecreateBet, handleEditTicket } = usePlayDetails();
  const [selectedValue, setSelectedValue] = useState<string>('');
  const { role } = useAuth();

  // 👇 Estado local para abrir/cerrar el modal
  const [isRepeatOpen, setIsRepeatOpen] = useState(false);

  const openRepeatModal = () => setIsRepeatOpen(true);
  const closeRepeatModal = () => setIsRepeatOpen(false);

  const handleSearch = (search: string) => {
    const parsed = parseInt(search);
    setUserNumber(isNaN(parsed) ? undefined : parsed);
  };

  const handleRePrimtLast = async () => {
    const lastTicketStr = localStorage.getItem('lastTicket');
    if (!lastTicketStr) {
      toast.error('No hay ticket guardado para reimprimir');
      return;
    }
    const lastTicket = JSON.parse(lastTicketStr);
    const { blob, fileName } = await makeTicketPdf(lastTicket);
    // Heurística simple: si es mobile, priorizo compartir; si desktop, imprimir
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    try {
      if (isMobile) {
        // 1) Intentá compartir el archivo directamente (Chrome Android)
        await sharePdfBlob(blob, fileName, {
          text: `Ticket ${lastTicket.ticket.ticket_number}`,
        });
      } else {
        // Desktop: imprimir directo
        await printPdfBlob(blob);
      }
    } catch {
      // Garantizá una salida
      await printPdfBlob(blob);
    }
  };

  const { data: tickets } = useGetTicketsNumber({
    user_id: cashier?.user_id,
    date: dayjs().format('YYYY-MM-DD'),
    enabled: !!cashier?.user_id,
  });

  const handleSelectTicket = (value: string) => {
    if (tickets?.length) {
      handleEditTicket(value);
      setSelectedValue(value);
    }
  };

  useEffect(() => {
    if (!userNumber) setSelectedValue('');
  }, [userNumber]);

  return (
    <HeaderSection title={' Realizar Jugadas'} className='gap-2'>
      {role !== USER_TYPE.CASHIER && (
        <Flex className=" w-full  justify-start sm:justify-end gap-1 sm:gap-2 xl:gap-3 ">
          <Flex className={'flex-row items-center justify-start gap-2 sm:gap-4 lg:gap-1.5 w-full sm:w-auto'}>
            <Label htmlFor={'user'} className="hidden sm:inline text-xs sm:text-sm lg:text-base whitespace-nowrap"> Usuario</Label>
            <Input
              type={'number'}
              inputMode="numeric"
              id={'user'}
              name={'user'}
              placeholder='Usuario'
              className={'w-20 sm:max-w-[100px] text-xs sm:text-sm lg:text-base h-8 sm:h-9 lg:h-7'}
              value={userNumber?.toString() ?? ''}
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
            />
            <div className="flex-1 truncate">
              <Label htmlFor={'user'} className="text-xs w-20 sm:text-sm lg:text-xs truncate"> {cashier?.name}</Label>
            </div>
          </Flex>
          
          <Flex className={'flex-row items-center justify-start gap-2 xl:gap-4 lg:gap-1.5 w-full sm:w-auto'}>
            <Label htmlFor={'ticket'} className="text-xs sm:text-sm lg:text-xs whitespace-nowrap">Ticket</Label>
            <Select onValueChange={(value) => handleSelectTicket(value)} value={selectedValue}>
              <SelectTrigger className=" border-dark-lighter text-xs sm:text-sm lg:text-xs h-8 sm:h-9 lg:h-7">
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
        <Flex className="flex-row w-full flex-wrap justify-center sm:justify-end gap-2 lg:gap-1.5">
          <IconButton
            type="button"
            label="Repetir Ticket"
            icon={<Repeat2Icon className="w-4 h-4" />}
            onClick={openRepeatModal}
            className="flex-1 sm:flex-none"
          />

          <IconButton
            type="button"
            label="Reimprimir"
            icon={<PrinterIcon className="w-4 h-4" />}
            variant="outline"
            onClick={handleRePrimtLast}
            className="flex-1 sm:flex-none "
          />

          <IconButton
            type="button"
            label="Cancelar"
            variant="destructive"
            className="flex-1 sm:flex-none"
          />
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
