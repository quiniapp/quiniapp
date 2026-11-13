import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  IPollaEditionEntityFront,
  POLLA_EDITION_STATUS,
  pollaEditionDrawLabels,
  pollaEditionTitle,
} from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditions } from '@/hooks/fetchs/usePollaData';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import { editionLabel } from './format';

/**
 * Edición elegida en Jugadas y Administrar jugadas (`polla_edition_id` de la
 * URL), con los nombres de quinielas y turnos para rotularla (todos sus
 * sorteos). Sin edición elegida se abre en la más reciente que siga activa.
 */
export const useBetsEdition = () => {
  const { organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editionId = searchParams.get('polla_edition_id') ?? '';

  const { data: editions } = useEditions({ polla_organization_id: organizationId ?? undefined });
  const catalogs = useDrawCatalogs(organizationId);

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

  /** Para el selector: nombre, sorteos y fechas. */
  const labelFor = useCallback(
    (edition: IPollaEditionEntityFront) => editionLabel(edition, catalogs),
    [catalogs]
  );
  /** Nombre y sorteos separados por coma (título de PDFs). */
  const titleFor = useCallback(
    (edition: IPollaEditionEntityFront) => pollaEditionTitle(edition, catalogs),
    [catalogs]
  );
  /** Estado de la edición de una jugada (para "No ganó"). */
  const statusById = useMemo(
    () => new Map(editionList.map((edition) => [edition.polla_edition_id, edition.status])),
    [editionList]
  );
  const editionStatusOf = useCallback((id: string) => statusById.get(id), [statusById]);
  /** Un sorteo por línea (ticket impreso). */
  const drawLabelsFor = useCallback(
    (edition: IPollaEditionEntityFront) => pollaEditionDrawLabels(edition, catalogs),
    [catalogs]
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
    labelFor,
    titleFor,
    drawLabelsFor,
    editionStatusOf,
    updateEdition,
  };
};
