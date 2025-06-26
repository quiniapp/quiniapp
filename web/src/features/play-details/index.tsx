import Box from '@/components/box';
import FillOutATicket from '@/features/play-details/fill-out-a-ticket.tsx';
import HeaderPlayDetail from '@/features/play-details/header-play-detail.tsx';
import { useState } from 'react';
import ResultsOverview from './results-overview';
import { useCreateTicket } from '@/hooks/useTicket';
import { INewBetEntity } from '../../../../helper/request/bet.response';
import PlayDetailGameTable from './play-detail-game-table';
import { FlexCol } from '@/components/flex';
import { useSessionStore } from '@/stores/sessionStore';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

const PlayDetailsContent = () => {
  const { user } = useSessionStore();
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [bets, setBets] = useState<INewBetEntity[]>([]);
  const { mutate: createTicket } = useCreateTicket();
  
  //! ResultsOverview crea el ticket
  const handleCreateBet = () => {
    createTicket({
      bets:bets,
      date: dayjs().format('YYYY-MM-DD'),
      user_id:user?.user_id!,
      user_name: user?.username!
    },{
      onSuccess:()=>{
        setBets([])
        setPartialAmount(0)
        setTotalAmount(0)
        toast.success('Ticket creado correctamente');
      },
      onError:()=>{
        
        toast.success('Ocurrió un error, intente de nuevo');
      }
    })

  };
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderPlayDetail />
      <FlexCol>
        <FillOutATicket
          setTotalAmount={setTotalAmount}
          setPartialAmount={setPartialAmount}
          setBets={setBets}
        />
        <PlayDetailGameTable bets={bets} />
      </FlexCol>
      <ResultsOverview
        partialAmount={partialAmount}
        totalAmount={totalAmount}
        handleCreateBet={handleCreateBet}
      />
    </Box>
  );
};

export default PlayDetailsContent;
