import { IPollaBetEntityFront } from '@helper/polla/types/game.type';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { useApiMutation } from '../useApi';

// ------------------------------------------------------------- catálogos

const catalogKeys = ['polla-organizations', 'polla-groups', 'polla-lotteries', 'polla-schedules'];

export const useCreateOrganization = () =>
  useApiMutation('post', BACKEND_ROUTES.organization.base, {
    invalidate: ['polla-organizations'],
    successMessage: 'Organización creada',
  });

export const useUpdateOrganization = () =>
  useApiMutation<unknown, { id: string; name: string }>(
    'put',
    ({ id }) => BACKEND_ROUTES.organization.id(id),
    { invalidate: ['polla-organizations'], successMessage: 'Organización actualizada' }
  );

export const useDeleteOrganization = () =>
  useApiMutation<unknown, { id: string }>(
    'delete',
    ({ id }) => BACKEND_ROUTES.organization.id(id),
    { invalidate: ['polla-organizations'], successMessage: 'Organización eliminada' }
  );

export const useCreateGroup = () =>
  useApiMutation('post', BACKEND_ROUTES.group.base, {
    invalidate: ['polla-groups'],
    successMessage: 'Grupo creado',
  });

export const useDeleteGroup = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.group.id(id), {
    invalidate: ['polla-groups'],
    successMessage: 'Grupo eliminado',
  });

export const useCreateLottery = () =>
  useApiMutation('post', BACKEND_ROUTES.lottery.base, {
    invalidate: ['polla-lotteries'],
    successMessage: 'Quiniela creada',
  });

export const useDeleteLottery = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.lottery.id(id), {
    invalidate: ['polla-lotteries'],
    successMessage: 'Quiniela eliminada',
  });

export const useCreateSchedule = () =>
  useApiMutation('post', BACKEND_ROUTES.schedule.base, {
    invalidate: ['polla-schedules'],
    successMessage: 'Turno creado',
  });

export const useDeleteSchedule = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.schedule.id(id), {
    invalidate: ['polla-schedules'],
    successMessage: 'Turno eliminado',
  });

// -------------------------------------------------------------- usuarios

export const useCreateUser = () =>
  useApiMutation('post', BACKEND_ROUTES.user.base, {
    invalidate: ['polla-users'],
    successMessage: 'Usuario creado',
  });

export const useUpdateUser = () =>
  useApiMutation<unknown, { id: string } & Record<string, unknown>>(
    'put',
    ({ id }) => BACKEND_ROUTES.user.id(id),
    { invalidate: ['polla-users', 'polla-user'], successMessage: 'Usuario actualizado' }
  );

export const useDeleteUser = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.user.id(id), {
    invalidate: ['polla-users'],
    successMessage: 'Usuario eliminado',
  });

export const useAdjustCredits = () =>
  useApiMutation<
    { balance: number },
    { id: string; amount: number; type: string; reason?: string | null }
  >('post', ({ id }) => BACKEND_ROUTES.user.credits(id), {
    invalidate: ['polla-users', 'polla-credits'],
    successMessage: 'Créditos actualizados',
  });

// -------------------------------------------------------------- ediciones

export const useCreateEdition = () =>
  useApiMutation('post', BACKEND_ROUTES.edition.base, {
    invalidate: ['polla-editions'],
    successMessage: 'Edición creada',
  });

export const useUpdateEdition = () =>
  useApiMutation<unknown, { id: string } & Record<string, unknown>>(
    'put',
    ({ id }) => BACKEND_ROUTES.edition.id(id),
    { invalidate: ['polla-editions'], successMessage: 'Edición actualizada' }
  );

export const useDeleteEdition = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.edition.id(id), {
    invalidate: ['polla-editions'],
    successMessage: 'Edición eliminada',
  });

// ---------------------------------------------------------------- jugadas

export const useCreateBet = () =>
  useApiMutation<
    IPollaBetEntityFront,
    { polla_edition_id: string; numbers: string[]; polla_user_id?: string; date?: string }
  >('post', BACKEND_ROUTES.bet.base, {
    invalidate: ['polla-bets', 'polla-editions', 'polla-credits', 'polla-users'],
    successMessage: 'Jugada cargada',
  });

export const useUpdateBet = () =>
  useApiMutation<IPollaBetEntityFront, { id: string; numbers: string[] }>(
    'put',
    ({ id }) => BACKEND_ROUTES.bet.id(id),
    { invalidate: ['polla-bets'], successMessage: 'Jugada actualizada' }
  );

export const useDeleteBet = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.bet.id(id), {
    invalidate: ['polla-bets', 'polla-editions', 'polla-credits', 'polla-users'],
    successMessage: 'Jugada eliminada',
  });

// ------------------------------------------------------------- resultados

export const useCreateResult = () =>
  useApiMutation('post', BACKEND_ROUTES.result.base, {
    invalidate: ['polla-results'],
    successMessage: 'Resultados cargados',
  });

export const useUpdateResult = () =>
  useApiMutation<unknown, { id: string; results: string[] }>(
    'put',
    ({ id }) => BACKEND_ROUTES.result.id(id),
    { invalidate: ['polla-results'], successMessage: 'Resultados actualizados' }
  );

export const useDeleteResult = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.result.id(id), {
    invalidate: ['polla-results'],
    successMessage: 'Resultados eliminados',
  });

export const useProcessResults = () =>
  useApiMutation('post', BACKEND_ROUTES.result.process, {
    invalidate: ['polla-bets', 'polla-editions', 'polla-winners', 'polla-current-accounts'],
    successMessage: 'Aciertos procesados',
  });

// --------------------------------------------------------- cuenta corriente

export const useCalculateCurrentAccounts = () =>
  useApiMutation('post', BACKEND_ROUTES.currentAccount.calculate, {
    invalidate: ['polla-current-accounts'],
    successMessage: 'Cuentas recalculadas',
  });

export const useLiquidateCurrentAccounts = () =>
  useApiMutation('post', BACKEND_ROUTES.currentAccount.liquidate, {
    invalidate: ['polla-current-accounts'],
    successMessage: 'Cuentas liquidadas',
  });

export const useUpdateCurrentAccount = () =>
  useApiMutation<unknown, { id: string } & Record<string, unknown>>(
    'put',
    ({ id }) => BACKEND_ROUTES.currentAccount.id(id),
    { invalidate: ['polla-current-accounts'], successMessage: 'Cuenta actualizada' }
  );

export { catalogKeys };
