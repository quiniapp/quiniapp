import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  IPollaEditionEntityFront,
  pollaEditionDrawLabels,
  pollaEditionTitle,
} from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditionById, useEditionPages, useFetchEdition } from '@/hooks/fetchs/usePollaData';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
import { preferredEdition, uniqueById } from '@/lib/editionSelect';
import { editionLabel } from './format';

const editionIdOf = (edition: IPollaEditionEntityFront) => edition.polla_edition_id;

/**
 * Edición elegida en Jugadas, Administrar jugadas, Ventas y Premios
 * (`polla_edition_id` de la URL), con los nombres de quinielas y turnos para
 * rotularla (todos sus sorteos). El selector trae `limit` por página (de la
 * más nueva a la más vieja) y, con `fetchMore`, la siguiente al llegar al
 * final; sin edición elegida se abre en la primera activa de lo cargado.
 *
 * `editionList` es solo lo cargado: lo que necesite otra edición la busca con
 * `editionOf` (cargadas y elegida) o la pide con `fetchEdition`.
 */
export const useBetsEdition = ({ limit, fetchMore }: { limit: number; fetchMore: boolean }) => {
  const { organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editionId = searchParams.get('polla_edition_id') ?? '';

  const pages = useEditionPages(
    { polla_organization_id: organizationId ?? undefined },
    { limit, fetchMore }
  );
  const catalogs = useDrawCatalogs(organizationId);

  const editionList = useMemo(
    () => uniqueById(pages.data?.pages.flatMap((page) => page.data) ?? [], editionIdOf),
    [pages.data]
  );
  const listed = editionList.find((e) => e.polla_edition_id === editionId);
  // La elegida que no está en lo cargado (un link viejo) se pide sola, una vez
  // que llegó la primera página.
  const { data: fetched } = useEditionById(
    editionId && pages.isSuccess && !listed ? editionId : null
  );
  // La query deja ver la anterior mientras carga: solo vale si es la elegida.
  const selectedEdition = listed ?? (fetched?.polla_edition_id === editionId ? fetched : undefined);

  useEffect(() => {
    if (editionId) return;
    const preferred = preferredEdition(editionList);
    if (!preferred) return;
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
  /** Un sorteo por línea (ticket impreso). */
  const drawLabelsFor = useCallback(
    (edition: IPollaEditionEntityFront) => pollaEditionDrawLabels(edition, catalogs),
    [catalogs]
  );

  /** Las ediciones que se conocen sin pedir nada: las cargadas y la elegida. */
  const known = useMemo(() => {
    const byId = new Map(editionList.map((edition) => [edition.polla_edition_id, edition]));
    if (selectedEdition) byId.set(selectedEdition.polla_edition_id, selectedEdition);
    return byId;
  }, [editionList, selectedEdition]);
  const editionOf = useCallback((id: string) => known.get(id), [known]);
  /** Respaldo del estado de una jugada (cada jugada ya trae `edition_status`). */
  const editionStatusOf = useCallback((id: string) => known.get(id)?.status, [known]);

  /** Una edición cualquiera: la conocida o, si no, se pide por id. */
  const fetchById = useFetchEdition();
  const fetchEdition = useCallback(
    async (id: string) => known.get(id) ?? fetchById(id),
    [known, fetchById]
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

  /** Lo que necesita `EditionSelect`: `<EditionSelect {...editionSelect} />`. */
  const editionSelect = {
    items: editionList,
    value: editionId,
    onChange: updateEdition,
    idOf: editionIdOf,
    labelOf: labelFor,
    hasNextPage: Boolean(pages.hasNextPage),
    isFetchingNextPage: pages.isFetchingNextPage,
    fetchNextPage: pages.fetchNextPage,
    selectedFallback: listed ? undefined : selectedEdition,
  };

  return {
    editionId,
    editionList,
    selectedEdition,
    editionSelect,
    labelFor,
    titleFor,
    drawLabelsFor,
    editionOf,
    editionStatusOf,
    fetchEdition,
    updateEdition,
  };
};
