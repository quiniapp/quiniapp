import Box from '@/components/box';
import FillOutATicket from '@/features/play-details/fill-out-a-ticket.tsx';
import HeaderPlayDetail from '@/features/play-details/header-play-detail.tsx';
import { useState } from 'react';
import ResultsOverview from './results-overview';


const PlayDetailsContent = () => {
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [partialAmount, setPartialAmount] = useState<number>(0)
  //! ResultsOverview crea el ticket
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
   
        <HeaderPlayDetail />
        <FillOutATicket setTotalAmount={setTotalAmount} setPartialAmount={setPartialAmount}/>
   
        <ResultsOverview partialAmount={partialAmount} totalAmount={totalAmount}/>
    </Box>
  );
};

export default PlayDetailsContent;
