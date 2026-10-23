import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FileDown, LoaderCircle } from 'lucide-react';
import { POLLA_EXPORT_PAGE_SIZE } from '@helper/polla/config/session.config';
import { IPollaBetListItem, IPollaEditionEntityFront } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { PollaPage, cleanParams } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { makeEditionTicketsPdf } from '@/functions/editionTicketsPDF';
import { sharePdf } from '@/functions/printPdf';
import { fetchOrganizationName } from '@/features/current-account/fetchers';

export interface TicketsPdfFilters {
  cashier_polla_user_id?: string;
  /** Las de un jugador (filtro "Jugador" de Jugadas). */
  polla_user_id?: string;
  polla_group_id?: string;
  /** `true`: ganadoras; `false`: no ganadoras. */
  winner?: boolean;
  /** Aciertos exactos separados por coma (`10,9`). */
  hits?: string;
  /** Días de carga (`YYYY-MM-DD`, los dos o ninguno). */
  load_from?: string;
  load_to?: string;
  sort?: 'hits' | 'recent';
}

type Progress =
  | { phase: 'idle' }
  | { phase: 'loading'; loaded: number; total: number }
  | { phase: 'building' };

const fmtCount = (n: number) => new Intl.NumberFormat('es-AR').format(n);

/**
 * Todas las jugadas de la edición con esos filtros, de a 1000 por keyset: una
 * edición puede tener miles de tickets.
 */
const fetchAllTickets = async (
  editionId: string,
  filters: TicketsPdfFilters,
  onProgress: (loaded: number, total: number) => void
) => {
  const rows: IPollaBetListItem[] = [];
  let cursor: string | undefined;
  let total = 0;

  do {
    const page = await apiClient.get<PollaPage<IPollaBetListItem>>(BACKEND_ROUTES.bet.base, {
      params: cleanParams({
        polla_edition_id: editionId,
        export: true,
        limit: POLLA_EXPORT_PAGE_SIZE,
        cursor,
        sort: filters.sort ?? 'hits',
        cashier_polla_user_id: filters.cashier_polla_user_id,
        polla_user_id: filters.polla_user_id,
        polla_group_id: filters.polla_group_id,
        winner: filters.winner,
        hits: filters.hits,
        load_from: filters.load_from,
        load_to: filters.load_to,
      }),
    });

    // El COUNT viene solo en la primera página (sin cursor).
    if (!cursor) total = page.pagination.totalCount;
    rows.push(...page.data);
    onProgress(rows.length, Math.max(total, rows.length));
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return rows;
};

/**
 * "Compartir PDF": baja todas las jugadas de la edición (con los filtros que se
 * eligieron), arma el PDF para imprimir en blanco y negro y lo comparte (mobile)
 * o lo descarga (desktop). Mientras tanto muestra un spinner con el progreso.
 * La API lo acota a lo que administra cada rol, como Administrar jugadas.
 */
export const ShareTicketsPdfButton = ({
  edition,
  lotteryName,
  scheduleName,
  filters = {},
  filtersLabel,
  className,
}: {
  edition: IPollaEditionEntityFront;
  lotteryName: string;
  scheduleName: string;
  filters?: TicketsPdfFilters;
  filtersLabel?: string;
  className?: string;
}) => {
  const { organizationId } = useAuth();
  const [progress, setProgress] = useState<Progress>({ phase: 'idle' });
  const busy = progress.phase !== 'idle';

  const handleClick = async () => {
    setProgress({ phase: 'loading', loaded: 0, total: edition.bets_count ?? 0 });
    try {
      const [rows, orgName] = await Promise.all([
        fetchAllTickets(edition.polla_edition_id, filters, (loaded, total) =>
          setProgress({ phase: 'loading', loaded, total })
        ),
        fetchOrganizationName(organizationId),
      ]);

      setProgress({ phase: 'building' });
      // Armar miles de filas bloquea el hilo: antes se deja pintar el spinner.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const { blob, fileName } = await makeEditionTicketsPdf({
        rows,
        edition,
        lotteryName,
        scheduleName,
        orgName,
        filtersLabel,
      });

      await sharePdf(blob, fileName, `Tickets de la Polla ${lotteryName} · ${scheduleName}`);
    } catch {
      toast.error('No se pudo generar el PDF de tickets');
    } finally {
      setProgress({ phase: 'idle' });
    }
  };

  let label = 'Compartir PDF';
  if (progress.phase === 'loading') {
    label = progress.total
      ? `Cargando ${fmtCount(progress.loaded)} de ${fmtCount(progress.total)}…`
      : 'Cargando tickets…';
  } else if (progress.phase === 'building') {
    label = 'Generando PDF…';
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? <LoaderCircle className="animate-spin" /> : <FileDown />}
      {label}
    </Button>
  );
};
