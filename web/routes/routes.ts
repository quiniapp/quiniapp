import { BACKEND_URL, ENVIRONMENT } from '@/env.ts';

const URL = ENVIRONMENT === 'develop' ? 'http://localhost:3000' : BACKEND_URL;
const BASE = `${URL}/api`;
const PRIVATE = `${BASE}/private`;

export const ROUTES = {
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
  },
  winners: {
    base: `${PRIVATE}/winners`,
    id: (id: string) => `${PRIVATE}/winners/${id}`,
  },
  current_account: {
    base: `${PRIVATE}/current_account`,
    id: (id: string) => `${PRIVATE}/current_account/${id}`,
  },
  results: {
    base: `${PRIVATE}/results`,
    id: (id: string) => `${PRIVATE}/results/${id}`,
  }
};
