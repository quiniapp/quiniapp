import Box from '@/components/box';
import FillOutATicket from '@/features/play-details/fill-out-a-ticket.tsx';
import HeaderPlayDetail from '@/features/play-details/header-play-detail.tsx';
import { useCallback, useState } from 'react';
import ResultsOverview from './results-overview';
import { useCreateTicket } from '@/hooks/useTicket';
import { INewBetEntity } from '../../../../helper/request/bet.response';
import PlayDetailGameTable from './play-detail-game-table';
import { FlexCol } from '@/components/flex';
import { useSessionStore } from '@/stores/sessionStore';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { IUserEntityFront } from '../../../../helper/types/user.type';

const PlayDetailsContent = () => {
  const { user } = useSessionStore();
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [bets, setBets] = useState<INewBetEntity[]>([]);
  const [cashier, setCashier] = useState<IUserEntityFront| undefined>(undefined)
  const { mutate: createTicket } = useCreateTicket();

  //! ResultsOverview crea el ticket
  const handleCreateBet = () => {

    createTicket({
      bets:bets,
      date: dayjs().format('YYYY-MM-DD'),
      user_id:cashier?.user_id ?? user?.user_id!,
      user_name: cashier?.name ?? user?.name!
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
  
const handleSearch = useCallback((searchCashier:IUserEntityFront)=>{
  if(searchCashier){
    setCashier(searchCashier)
  }
},[])

const handleResetBets = ()=>{

        setBets([])
        setPartialAmount(0)
        setTotalAmount(0)
}
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderPlayDetail setCashier={handleSearch}/>
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
        handleResetBets={handleResetBets}
      />
    </Box>
  );
};

export default PlayDetailsContent;
