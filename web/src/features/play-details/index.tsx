import Box from '@/components/box';
import FillOutATicket from '@/features/play-details/fill-out-a-ticket.tsx';
import HeaderPlayDetail from '@/features/play-details/header-play-detail.tsx';
import ResultsOverview from '@/features/play-details/results-overview.tsx';

const PlayDetailsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderPlayDetail />
      <FillOutATicket />
      <ResultsOverview />
    </Box>
  );
};

export default PlayDetailsContent;
