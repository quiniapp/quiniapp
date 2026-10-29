import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IPollaEditionEntityFront, POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditions } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { editionLabel } from './format';

/**
 * Edición elegida en Jugadas y Administrar jugadas (`polla_edition_id` de la
 * URL), con los nombres de quinielas y turnos para rotularla. Sin edición
 * elegida se abre en la más reciente que siga activa.
 */
export const useBetsEdition = () => {
  const { organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editionId = searchParams.get('polla_edition_id') ?? '';

  const { data: editions } = useEditions({ polla_organization_id: organizationId ?? undefined });
  const { data: lotteries } = useLotteries({ polla_organization_id: organizationId ?? undefined });
  const { data: schedules } = useSchedules({ polla_organization_id: organizationId ?? undefined });

  const lotteryById = useMemo(
    () => new Map(lotteries?.data.map((l) => [l.polla_lottery_id, l.name])),
    [lotteries]
  );
  const scheduleById = useMemo(
    () => new Map(schedules?.data.map((s) => [s.polla_schedule_id, s.name])),
    [schedules]
  );

  const editionList = useMemo(() => editions?.data ?? [], [editions]);
  const selectedEdition = editionList.find((e) => e.polla_edition_id === editionId);

  useEffect(() => {
    if (editionId || editionList.length === 0) return;
    const preferred =
      editionList.find((e) => e.status === POLLA_EDITION_STATUS.ACTIVE) ?? editionList[0];
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('polla_edition_id', preferred.polla_edition_id);
        return next;
      },
      { replace: true }
    );
  }, [editionId, editionList, setSearchParams]);

  const labelFor = useCallback(
    (edition: IPollaEditionEntityFront) =>
      editionLabel(
        edition,
        lotteryById.get(edition.polla_lottery_id),
        scheduleById.get(edition.polla_schedule_id)
      ),
    [lotteryById, scheduleById]
  );

  const updateEdition = useCallback(
    (value: string) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('polla_edition_id', value);
        return next;
      }),
    [setSearchParams]
  );

  return {
    editionId,
    editionList,
    selectedEdition,
    lotteryById,
    scheduleById,
    labelFor,
    updateEdition,
  };
};
