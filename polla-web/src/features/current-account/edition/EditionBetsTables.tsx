import { useBetsOfDay } from '@/hooks/fetchs/usePollaData';
import { BetsTablesView } from '../DayBetsTables';

/**
 * Tickets de un pasador en la edición (con los que se borraron después) y las
 * borradas que se descuentan. Sin `cashierId` son los propios (`mine`).
 */
export const EditionBetsTables = ({
  editionId,
  cashierId,
}: {
  editionId: string;
  cashierId?: string;
}) => {
  const scope = {
    polla_edition_id: editionId,
    ...(cashierId ? { cashier_polla_user_id: cashierId } : { mine: true }),
  };

  const { data: tickets, isFetching: loadingTickets } = useBetsOfDay({
    ...scope,
    with_deducted: true,
  });
  const { data: deleted, isFetching: loadingDeleted } = useBetsOfDay({
    ...scope,
    deducted_only: true,
  });

  return (
    <BetsTablesView
      span="de la edición"
      tickets={tickets?.data}
      deleted={deleted?.data}
      loadingTickets={loadingTickets}
      loadingDeleted={loadingDeleted}
    />
  );
};
