import FillOutATicket from '@/features/make-plays/fill-out-a-ticket';
import HeaderPlayDetail from '@/features/make-plays/header-play-detail';
import ResultsOverview from './results-overview';
import PlayDetailGameTable from './play-detail-game-table';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { MakePlaysProvider } from './provider/MakePlaysProvider';

const MakePlaysContent = () => {
  return (
    <PageWrapper>
      <HeaderPlayDetail />
      <FillOutATicket />
      <PlayDetailGameTable />
      <ResultsOverview />
    </PageWrapper>
  );
};

const MakePlaysContentWithProvider = () => (
  <MakePlaysProvider>
    <MakePlaysContent />
  </MakePlaysProvider>
);

export default MakePlaysContentWithProvider;
