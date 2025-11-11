// src/routes/routes.ts (frontend)
const BASE = '/api';
const PRIVATE = `${BASE}/private`;

export const BACKEND_ROUTES = {
  auth: {
    login: `${BASE}/auth/login`,
    logout: `${PRIVATE}/auth/logout`,
    validate: `${PRIVATE}/auth/validate`,
  },
  user: {
    base: `${PRIVATE}/user`,
    id: (id: string) => `${PRIVATE}/user/${id}`,
  },
  bet: {
    base: `${PRIVATE}/bet`,
    id: (id: string) => `${PRIVATE}/bet/${id}`,
    totalAmount: `${PRIVATE}/bet/total`,
    totalPrize: `${PRIVATE}/bet/prize`
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
    number:`${PRIVATE}/ticket/number`,
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
  settings:{
    storage:  `${PRIVATE}/settings/storage`
  }
};
