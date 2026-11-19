import { useQuery } from '@tanstack/react-query';
import { fetchOrganizationName } from './fetchers';

/**
 * El nombre de la organización, traído de antemano: los exportes lo usan sin
 * pedirlo entre el toque del usuario y la hoja de compartir (Safari exige poco
 * tiempo entre ambos).
 */
export const useOrganizationName = (organizationId: string | null) =>
  useQuery({
    queryKey: ['polla-organizations', 'name', organizationId],
    queryFn: () => fetchOrganizationName(organizationId),
    staleTime: Infinity,
  });
