const BASE = '/api';
const PRIVATE = `${BASE}/private`;

const routes = {
  auth: {
    login: `${BASE}/login`,
    logout: `${PRIVATE}/logout`,
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
};
