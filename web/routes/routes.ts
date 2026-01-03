// src/routes/routes.ts (frontend)
const BASE = '/api';
const PRIVATE = `${BASE}/private`;

export const BACKEND_ROUTES = {
  auth: {
    login: `${BASE}/auth/login`,
    refresh: `${BASE}/auth/refresh`,
    logout: `${PRIVATE}/auth/logout`,
    logoutAll: `${PRIVATE}/auth/logout-all`,
    validate: `${PRIVATE}/auth/validate`,
  },
  user: {
    base: `${PRIVATE}/user`,
    id: (id: string) => `${PRIVATE}/user/${id}`,
    resetPassword: (id: string) => `${PRIVATE}/user/reset-password/${id}`,
    changePassword: `${PRIVATE}/user/change-password`,
    validateCapitalist: (username: string, organizationId: string) =>
      `${PRIVATE}/user/validate-capitalist?username=${encodeURIComponent(username)}&organization_id=${encodeURIComponent(organizationId)}`,
  },
  bet: {
    base: `${PRIVATE}/bet`,
    id: (id: string) => `${PRIVATE}/bet/${id}`,
    totalAmount: `${PRIVATE}/bet/total`,
    totalPrize: `${PRIVATE}/bet/prize`,
    amounts: `${PRIVATE}/bet/amounts`,
  },
  lottery: {
    base: `${PRIVATE}/lottery`,
    id: (id: string) => `${PRIVATE}/lottery/${id}`,
  },
  schedule: {
    base: `${PRIVATE}/schedule`,
    id: (id: string) => `${PRIVATE}/schedule/${id}`,
  },
  ticket: {
    base: `${PRIVATE}/ticket`,
    id: (id: string) => `${PRIVATE}/ticket/${id}`,
    number: `${PRIVATE}/ticket/number`,
    paid: (ticket_number: string) => `${PRIVATE}/ticket/paid/${ticket_number}`,
  },
  winners: {
    base: `${PRIVATE}/winners`,
    id: (id: string) => `${PRIVATE}/winners/${id}`,
  },
  current_account: {
    base: `${PRIVATE}/current_account`,
    id: (id: string) => `${PRIVATE}/current_account/${id}`,
    bulk: `${PRIVATE}/current_account/bulk`,
    calculate: `${PRIVATE}/current_account/calculate`,
    liquidate: `${PRIVATE}/current_account/liquidate`,
  },
  results: {
    base: `${PRIVATE}/results`,
    id: (id: string) => `${PRIVATE}/results/${id}`,
  },
  schedule_lottery: {
    base: `${PRIVATE}/schedule_lottery`,
  },
  settings: {
    storage: `${PRIVATE}/settings/storage`,
  },
  organization: {
    base: `${PRIVATE}/organization`,
    id: (id: string) => `${PRIVATE}/organization/${id}`,
    children: (id: string) => `${PRIVATE}/organization/${id}/children`,
    createSub: (id: string) => `${PRIVATE}/organization/${id}/sub`,
  },
};
