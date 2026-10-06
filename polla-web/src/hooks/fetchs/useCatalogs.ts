import {
  IPollaGroupEntityFront,
  IPollaLotteryEntityFront,
  IPollaOrganizationWithCapitalist,
  IPollaScheduleEntityFront,
} from '@helper/polla/types/catalog.type';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { PollaPage, QueryParams, useApiQuery } from '../useApi';

const CATALOG_STALE_TIME = 5 * 60 * 1000;

/** Cada organización viene con su capitalista (usuario y nombre). */
export const useOrganizations = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<PollaPage<IPollaOrganizationWithCapitalist>>(
    ['polla-organizations'],
    BACKEND_ROUTES.organization.base,
    { limit: 200, ...params },
    { staleTime: CATALOG_STALE_TIME, enabled }
  );

export const useGroups = (params: QueryParams = {}) =>
  useApiQuery<PollaPage<IPollaGroupEntityFront>>(
    ['polla-groups'],
    BACKEND_ROUTES.group.base,
    { limit: 200, ...params },
    { staleTime: CATALOG_STALE_TIME }
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
