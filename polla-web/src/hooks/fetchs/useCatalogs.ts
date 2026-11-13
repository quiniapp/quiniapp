import { useMemo } from 'react';
import { IPollaDrawCatalogs } from '@helper/polla/types/game.type';
import {
  IPollaGroupWithAdmin,
  IPollaLotteryEntityFront,
  IPollaOrganizationWithCapitalist,
  IPollaScheduleEntityFront,
} from '@helper/polla/types/catalog.type';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { PollaPage, QueryParams, useApiQuery } from '../useApi';

const CATALOG_STALE_TIME = 5 * 60 * 1000;

type IPollaGroupAdmin = NonNullable<IPollaGroupWithAdmin['admin']>;

/** Cada organización viene con su capitalista (usuario y nombre). */
export const useOrganizations = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<PollaPage<IPollaOrganizationWithCapitalist>>(
    ['polla-organizations'],
    BACKEND_ROUTES.organization.base,
    { limit: 200, ...params },
    { staleTime: CATALOG_STALE_TIME, enabled }
  );

/** Cada grupo viene con su admin (solo para superadmin+; para el resto, `null`). */
export const useGroups = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<PollaPage<IPollaGroupWithAdmin>>(
    ['polla-groups'],
    BACKEND_ROUTES.group.base,
    { limit: 200, ...params },
    { staleTime: CATALOG_STALE_TIME, enabled }
  );

/** Admins del modelo anterior, sin grupo: se asignan a un grupo sin admin. */
export const useAdminsWithoutGroup = (enabled = true) =>
  useApiQuery<IPollaGroupAdmin[]>(
    ['polla-groups', 'admins-without-group'],
    BACKEND_ROUTES.group.adminsWithoutGroup,
    {},
    { enabled }
  );

export const useLotteries = (params: QueryParams = {}) =>
  useApiQuery<PollaPage<IPollaLotteryEntityFront>>(
    ['polla-lotteries'],
    BACKEND_ROUTES.lottery.base,
    { limit: 200, ...params },
    { staleTime: CATALOG_STALE_TIME }
  );

export const useSchedules = (params: QueryParams = {}) =>
  useApiQuery<PollaPage<IPollaScheduleEntityFront>>(
    ['polla-schedules'],
    BACKEND_ROUTES.schedule.base,
    { limit: 200, ...params },
    { staleTime: CATALOG_STALE_TIME }
  );

/**
 * Quinielas y turnos para nombrar los sorteos de una edición
 * (`pollaEditionTitle`, `pollaEditionDrawLabels`).
 */
export const useDrawCatalogs = (organizationId?: string | null): IPollaDrawCatalogs => {
  const params = organizationId ? { polla_organization_id: organizationId } : {};
  const { data: lotteries } = useLotteries(params);
  const { data: schedules } = useSchedules(params);

  return useMemo(
    () => ({ lotteries: lotteries?.data, schedules: schedules?.data }),
    [lotteries, schedules]
  );
};
