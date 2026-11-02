import {
  IPollaBetEntityFront,
  IPollaGroupAccountEntityFront,
  IPollaProcessResult,
  IPollaRepeatResult,
} from '@helper/polla/types/game.type';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { useApiMutation } from '../useApi';

// ------------------------------------------------------------- catálogos

const catalogKeys = ['polla-organizations', 'polla-groups', 'polla-lotteries', 'polla-schedules'];

export const useCreateOrganization = () =>
  useApiMutation<
    unknown,
    {
      organization: { name: string };
      capitalist: {
        name: string;
        last_name?: string | null;
        username: string;
        password: string;
        email?: string | null;
        phone?: number | null;
      };
    }
  >('post', BACKEND_ROUTES.organization.base, {
    invalidate: ['polla-organizations'],
    successMessage: 'Organización y capitalista creados',
  });

export const useResetCapitalistPassword = () =>
  useApiMutation<unknown, { id: string; password: string }>(
    'post',
    ({ id }) => BACKEND_ROUTES.organization.resetCapitalist(id),
    { successMessage: 'Contraseña del capitalista blanqueada' }
  );

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

export interface NewGroupAdmin {
  name: string;
  last_name?: string | null;
  username: string;
  password: string;
  email?: string | null;
  phone?: number | null;
}

/** El grupo nace con su admin, como la organización con su capitalista. */
export const useCreateGroup = () =>
  useApiMutation<unknown, { group: { name: string }; admin: NewGroupAdmin }>(
    'post',
    BACKEND_ROUTES.group.base,
    {
      invalidate: ['polla-groups', 'polla-users'],
      successMessage: 'Grupo y admin creados',
    }
  );

/** A un grupo sin admin: un admin del modelo anterior (sin grupo) o uno nuevo. */
export const useAssignGroupAdmin = () =>
  useApiMutation<unknown, { id: string; polla_user_id?: string; admin?: NewGroupAdmin }>(
    'post',
    ({ id }) => BACKEND_ROUTES.group.assignAdmin(id),
    { invalidate: ['polla-groups', 'polla-users'], successMessage: 'Admin asignado al grupo' }
  );

export const useUpdateGroup = () =>
  useApiMutation<unknown, { id: string; name: string }>(
    'put',
    ({ id }) => BACKEND_ROUTES.group.id(id),
    { invalidate: ['polla-groups'], successMessage: 'Grupo actualizado' }
  );

export const useDeleteGroup = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.group.id(id), {
    invalidate: ['polla-groups', 'polla-users', 'polla-user-search'],
    successMessage: 'Grupo eliminado con su admin, pasadores y jugadores',
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
    invalidate: ['polla-users', 'polla-user-search', 'polla-user-next-number'],
    successMessage: 'Usuario creado',
  });

export const useUpdateUser = () =>
  useApiMutation<unknown, { id: string } & Record<string, unknown>>(
    'put',
    ({ id }) => BACKEND_ROUTES.user.id(id),
    {
      invalidate: ['polla-users', 'polla-user', 'polla-user-search'],
      successMessage: 'Usuario actualizado',
    }
  );

export const useDeleteUser = () =>
  useApiMutation<unknown, { id: string }>('delete', ({ id }) => BACKEND_ROUTES.user.id(id), {
    invalidate: ['polla-users', 'polla-user-search'],
    successMessage: 'Usuario eliminado',
  });

export const useResetUserPassword = () =>
  useApiMutation<unknown, { id: string; password: string }>(
    'post',
    ({ id }) => BACKEND_ROUTES.user.resetPassword(id),
    { successMessage: 'Contraseña blanqueada' }
  );

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
    // Sus jugadas se anulan y la cuenta corriente se recalcula.
    invalidate: ['polla-editions', 'polla-bets', 'polla-sales', 'polla-current-accounts'],
    successMessage: 'Edición eliminada y sus jugadas anuladas',
  });

// ---------------------------------------------------------------- jugadas

export const useCreateBet = () =>
  useApiMutation<
    IPollaBetEntityFront,
    {
      polla_edition_id: string;
      numbers: string[];
      polla_user_id?: string;
      date?: string;
      identifier?: string;
    }
  >('post', BACKEND_ROUTES.bet.base, {
    invalidate: ['polla-bets', 'polla-editions', 'polla-sales', 'polla-current-accounts'],
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
    invalidate: ['polla-bets', 'polla-editions', 'polla-sales', 'polla-current-accounts'],
    successMessage: 'Jugada eliminada',
  });

type RepeatVariables = { polla_edition_id: string; polla_bet_ids: string[] };

/** Repetir tickets (pagos) a nombre de su dueño original. Avisa la pantalla. */
export const useRepeatBets = () =>
  useApiMutation<IPollaRepeatResult, RepeatVariables>('post', BACKEND_ROUTES.bet.repeat, {
    invalidate: ['polla-bets', 'polla-editions', 'polla-sales', 'polla-current-accounts'],
  });

/** Repetir sin cargo (admin+) tickets de una edición finalizada. Avisa la pantalla. */
export const useFreeRepeatBets = () =>
  useApiMutation<IPollaRepeatResult, RepeatVariables>('post', BACKEND_ROUTES.bet.freeRepeat, {
    invalidate: ['polla-bets', 'polla-editions'],
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
  useApiMutation<
    IPollaProcessResult,
    { polla_schedule_id: string; date: string; polla_organization_id?: string }
  >('post', BACKEND_ROUTES.result.process, {
    invalidate: ['polla-bets', 'polla-editions', 'polla-winners', 'polla-current-accounts'],
    successMessage: 'Ganadores generados y cuenta corriente actualizada',
  });

// --------------------------------------------------------- cuenta corriente

/** `range_from`: liquidación por rango (si no, cada pasador desde su última liquidación). */
export const useCalculateCurrentAccounts = () =>
  useApiMutation<unknown, { date: string; range_from?: string; polla_organization_id?: string }>(
    'post',
    BACKEND_ROUTES.currentAccount.calculate,
    { invalidate: ['polla-current-accounts'], successMessage: 'Cuenta corriente actualizada' }
  );

/** Liquida en `date` a los pasadores de un grupo (`POLLA_LIQUIDATION_NO_GROUP`: sin grupo). */
export const useLiquidateCurrentAccounts = () =>
  useApiMutation<
    unknown,
    {
      date: string;
      range_from?: string;
      polla_group_id: string;
      polla_organization_id?: string;
    }
  >('post', BACKEND_ROUTES.currentAccount.liquidate, {
    invalidate: ['polla-current-accounts'],
    successMessage: 'Cuentas liquidadas',
  });

export const useUpdateCurrentAccount = () =>
  useApiMutation<unknown, { id: string } & Record<string, unknown>>(
    'put',
    ({ id }) => BACKEND_ROUTES.currentAccount.id(id),
    { invalidate: ['polla-current-accounts'], successMessage: 'Cuenta actualizada' }
  );

export const useBulkUpdateCurrentAccounts = () =>
  useApiMutation<
    unknown,
    {
      date: string;
      polla_organization_id?: string;
      updates: { polla_current_account_id: string; props: Record<string, number> }[];
    }
  >('put', BACKEND_ROUTES.currentAccount.bulk, {
    // Siempre va seguido de "liquidar día", que es el que avisa.
    invalidate: ['polla-current-accounts'],
  });

// ------------------------------------------------------- cuenta del grupo

export const useLiquidateGroup = () =>
  useApiMutation<
    IPollaGroupAccountEntityFront,
    {
      polla_group_id: string;
      date: string;
      admin_percentage: number;
      adjustments?: number;
      paid?: number;
    }
  >('post', BACKEND_ROUTES.groupAccount.liquidate, {
    invalidate: ['polla-group-accounts'],
    successMessage: 'Grupo liquidado',
  });

// ------------------------------------------------------------------ gastos

export const useCreateExpense = () =>
  useApiMutation<
    unknown,
    {
      date: string;
      name: string;
      amount: number;
      polla_group_id?: string | null;
      polla_organization_id?: string;
    }
  >('post', BACKEND_ROUTES.expense.base, { invalidate: ['polla-expenses'] });

export const useDeleteExpense = () =>
  useApiMutation<unknown, { id: string; polla_organization_id?: string }>(
    'delete',
    ({ id, polla_organization_id: org }) =>
      `${BACKEND_ROUTES.expense.id(id)}${org ? `?polla_organization_id=${org}` : ''}`,
    { invalidate: ['polla-expenses'] }
  );

export { catalogKeys };
