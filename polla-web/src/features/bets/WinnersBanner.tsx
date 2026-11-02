import { useWinners } from '@/hooks/fetchs/usePollaData';
import { fmtMoney } from './format';

/** Ganadores de la edición elegida, con su premio. */
export const WinnersBanner = ({ editionId }: { editionId: string }) => {
  const { data: winners } = useWinners(editionId || null);

  if (!winners || winners.data.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border-2 border-success bg-card p-3 text-sm text-card-foreground">
      <strong>Ganadores de la edición:</strong>{' '}
      {winners.data
        .map(
          (w) =>
            `${w.client_name ?? w.identifier ?? w.cashier_name} (${w.ticket_number}) $${fmtMoney(w.prize)}`
        )
        .join(' · ')}
    </div>
  );
};
