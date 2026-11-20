import { useQuery } from '@tanstack/react-query';
import { fetchOrganizationName } from './fetchers';

/**
 * El nombre de la organización, traído de antemano: los exportes lo usan sin
 * pedirlo entre el toque del usuario y la hoja de compartir (Safari exige poco
 * tiempo entre ambos). `fetchOrganizationName` devuelve `''` si falla: ese
 * vacío no queda fijo, se vuelve a pedir al próximo montaje (y los exportes
 * lo piden de nuevo con `||`).
 */
export const useOrganizationName = (organizationId: string | null) =>
  useQuery({
    queryKey: ['polla-organizations', 'name', organizationId],
    queryFn: () => fetchOrganizationName(organizationId),
    staleTime: (query) => (query.state.data ? Infinity : 0),
  });
