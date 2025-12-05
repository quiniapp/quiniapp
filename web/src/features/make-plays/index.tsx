import FillOutATicket from '@/features/make-plays/fill-out-a-ticket';
import HeaderPlayDetail from '@/features/make-plays/header-play-detail';
import ResultsOverview from './results-overview';
import PlayDetailGameTable from './play-detail-game-table';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { MakePlaysProvider } from './provider/MakePlaysProvider';
import React, { Suspense } from 'react';
import { usePlayDetails } from './context/MakePlaysContext';
import { LoadingState } from '@/components/molecules/LoadingState';

const ResetPartialModal = React.lazy(() => import('../../components/modals/ResetPartialModal'));

const MakePlaysContent = () => {
  const { openDeleteModal, setOpenDeleteModal, setPartialAmount } = usePlayDetails();

  const handleResetPartial = () => {
    setPartialAmount(0);
    setOpenDeleteModal(false);
  };

  return (
    <PageWrapper>
      <HeaderPlayDetail />
      <FillOutATicket />
      <PlayDetailGameTable />
      <ResultsOverview />
      <Suspense fallback={<LoadingState />}>
        <ResetPartialModal
          isOpen={openDeleteModal}
          onClose={() => setOpenDeleteModal(false)}
          onClick={handleResetPartial}
        />
      </Suspense>
    </PageWrapper>
  );
};

const MakePlaysContentWithProvider = () => (
  <MakePlaysProvider>
    <MakePlaysContent />
  </MakePlaysProvider>
);

export default MakePlaysContentWithProvider;
