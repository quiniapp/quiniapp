/**
 * Endpoints del backend de Polla. Vive dentro de `src/` a propósito: en
 * QuiniApp este archivo está fuera del alias `@/` y se importa con rutas
 * relativas de cuatro niveles desde decenas de archivos.
 */
const PUBLIC = '/api/polla';
const PRIVATE = '/api/polla/private';

export const BACKEND_ROUTES = {
  auth: {
    login: `${PUBLIC}/auth/login`,
    refresh: `${PUBLIC}/auth/refresh`,
    validate: `${PRIVATE}/auth/validate`,
    logout: `${PRIVATE}/auth/logout`,
    logoutAll: `${PRIVATE}/auth/logout-all`,
    changePassword: `${PRIVATE}/auth/change-password`,
    preferences: `${PRIVATE}/auth/preferences`,
  },
  organization: {
    base: `${PRIVATE}/organization`,
    id: (id: string) => `${PRIVATE}/organization/${id}`,
    resetCapitalist: (id: string) => `${PRIVATE}/organization/${id}/capitalist/reset-password`,
  },
  group: {
    base: `${PRIVATE}/group`,
    id: (id: string) => `${PRIVATE}/group/${id}`,
  },
  lottery: {
    base: `${PRIVATE}/lottery`,
    id: (id: string) => `${PRIVATE}/lottery/${id}`,
  },
  schedule: {
    base: `${PRIVATE}/schedule`,
    id: (id: string) => `${PRIVATE}/schedule/${id}`,
  },
  user: {
    base: `${PRIVATE}/user`,
    id: (id: string) => `${PRIVATE}/user/${id}`,
    byNumber: (number: string) => `${PRIVATE}/user/by-number/${encodeURIComponent(number)}`,
    resetPassword: (id: string) => `${PRIVATE}/user/${id}/reset-password`,
  },
  edition: {
    base: `${PRIVATE}/edition`,
    id: (id: string) => `${PRIVATE}/edition/${id}`,
  },
  bet: {
    base: `${PRIVATE}/bet`,
    id: (id: string) => `${PRIVATE}/bet/${id}`,
    winners: `${PRIVATE}/bet/winners`,
    last: `${PRIVATE}/bet/last`,
    sales: `${PRIVATE}/bet/sales`,
    ticket: (ticketNumber: string) => `${PRIVATE}/bet/ticket/${encodeURIComponent(ticketNumber)}`,
  },
  result: {
    base: `${PRIVATE}/result`,
    id: (id: string) => `${PRIVATE}/result/${id}`,
    process: `${PRIVATE}/result/process`,
  },
  currentAccount: {
    base: `${PRIVATE}/current_account`,
    id: (id: string) => `${PRIVATE}/current_account/${id}`,
    calculate: `${PRIVATE}/current_account/calculate`,
    liquidate: `${PRIVATE}/current_account/liquidate`,
    bulk: `${PRIVATE}/current_account/bulk`,
    totals: `${PRIVATE}/current_account/totals`,
  },
  expense: {
    base: `${PRIVATE}/expense`,
    id: (id: string) => `${PRIVATE}/expense/${id}`,
  },
};
