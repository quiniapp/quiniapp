import { PrinterIcon, Repeat2Icon } from 'lucide-react';
import React, { Suspense, useState } from 'react';

import { Flex } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { IUserEntityFront, USER_TYPE } from '../../../../helper/types/user.type';
import { useSessionStore } from '@/stores/sessionStore';
import { IBetTable } from '.';
import toast from 'react-hot-toast';
import { makeTicketPdf } from '../../../helper/function/makeTicket';

// 👇 Lazy import del modal (se carga sólo cuando se renderiza)
const RepeatTicketModal = React.lazy(
  () => import('@/components/modals/repeat-ticket-modal.tsx')
);

interface HeaderPlayDetailProps {
  cashier?: IUserEntityFront;
  userNumber?: number;
  setUserNumber: React.Dispatch<React.SetStateAction<number | undefined>>;
  handleRecreateBet: (values: IBetTable[]) => void;
}

const HeaderPlayDetail = ({
  cashier,
  userNumber,
  setUserNumber,
  handleRecreateBet,
}: HeaderPlayDetailProps) => {
  const { role } = useSessionStore();

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

  return (
    <HeaderSection title={' Realizar Jugadas'}>
      <Flex className={' items-center gap-2  justify-between w-full'}>
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
          <Button className="sm:w-fit p-1" type={'button'} onClick={openRepeatModal}>
            <Repeat2Icon className="w-2 h-2 sm:w-3 sm:h-3" />
            <Typography className="text-xs text-wrap" variant={'small'}>
              Repetir Ticket
            </Typography>
          </Button>

          <Button
            className="text-xs sm:w-fit p-1"
            type={'button'}
            variant={'outline'}
            onClick={handleRePrimtLast}
          >
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

      {/* 👇 Render condicional + Suspense para cargar el modal sólo cuando se abre */}
      {isRepeatOpen && (
        <Suspense fallback={<div className="p-4 text-sm text-slate-300">Cargando…</div>}>
          <RepeatTicketModal
            isOpen={isRepeatOpen}
            title={'Repetir Ticket'}
            onClose={closeRepeatModal}
            handleRecreateBet={(values) => {
              handleRecreateBet(values);
              // Si preferís cerrar desde acá al confirmar:
              // closeRepeatModal();
            }}
          />
        </Suspense>
      )}
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
