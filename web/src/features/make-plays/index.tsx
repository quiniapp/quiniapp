import FillOutATicket from '@/features/make-plays/fill-out-a-ticket';
import HeaderPlayDetail from '@/features/make-plays/header-play-detail';
import ResultsOverview from './results-overview';
import PlayDetailGameTable from './play-detail-game-table';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { MakePlaysProvider } from './provider/MakePlaysProvider';

const MakePlaysContent = () => {
  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-h-0">
        <HeaderPlayDetail />
        <FillOutATicket />
        <PlayDetailGameTable />
      </div>
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
