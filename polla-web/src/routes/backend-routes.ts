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
    adminsWithoutGroup: `${PRIVATE}/group/admins-without-group`,
    assignAdmin: (id: string) => `${PRIVATE}/group/${id}/admin`,
  },
  lottery: {
    base: `${PRIVATE}/lottery`,
    id: (id: string) => `${PRIVATE}/lottery/${id}`,
    order: `${PRIVATE}/lottery/order`,
  },
  schedule: {
    base: `${PRIVATE}/schedule`,
    id: (id: string) => `${PRIVATE}/schedule/${id}`,
  },
  user: {
    base: `${PRIVATE}/user`,
    id: (id: string) => `${PRIVATE}/user/${id}`,
    search: `${PRIVATE}/user/search`,
    nextNumber: `${PRIVATE}/user/next-number`,
    resetPassword: (id: string) => `${PRIVATE}/user/${id}/reset-password`,
    disabled: (id: string) => `${PRIVATE}/user/${id}/disabled`,
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
    lastEdition: `${PRIVATE}/bet/mine/last-edition`,
    repeat: `${PRIVATE}/bet/repeat`,
    freeRepeat: `${PRIVATE}/bet/free-repeat`,
    payment: `${PRIVATE}/bet/payment`,
    unpaidSummary: `${PRIVATE}/bet/unpaid-summary`,
    unpaid: `${PRIVATE}/bet/unpaid`,
    sales: `${PRIVATE}/bet/sales`,
    ticket: (ticketNumber: string) => `${PRIVATE}/bet/ticket/${encodeURIComponent(ticketNumber)}`,
    check: (ticketNumber: string) => `${PRIVATE}/bet/check/${encodeURIComponent(ticketNumber)}`,
  },
  prize: {
    base: `${PRIVATE}/prize`,
    paid: (betId: string) => `${PRIVATE}/prize/${betId}/paid`,
  },
  result: {
    base: `${PRIVATE}/result`,
    id: (id: string) => `${PRIVATE}/result/${id}`,
    process: `${PRIVATE}/result/process`,
    define: `${PRIVATE}/result/define`,
  },
  currentAccount: {
    base: `${PRIVATE}/current_account`,
    totals: `${PRIVATE}/current_account/totals`,
  },
  editionAccount: {
    base: `${PRIVATE}/edition_account`,
    mine: `${PRIVATE}/edition_account/mine`,
    totals: `${PRIVATE}/edition_account/totals`,
    groupAccounts: `${PRIVATE}/edition_account/group_accounts`,
    movement: (id: string) => `${PRIVATE}/edition_account/movements/${id}`,
    accounts: (editionId: string) => `${PRIVATE}/edition_account/${editionId}/accounts`,
    generate: (editionId: string) => `${PRIVATE}/edition_account/${editionId}/generate`,
    movements: (editionId: string) => `${PRIVATE}/edition_account/${editionId}/movements`,
    groupPreviews: (editionId: string) => `${PRIVATE}/edition_account/${editionId}/group_previews`,
    groupLiquidate: (editionId: string) =>
      `${PRIVATE}/edition_account/${editionId}/group_liquidate`,
  },
  groupAccount: {
    base: `${PRIVATE}/group_account`,
  },
  expense: {
    base: `${PRIVATE}/expense`,
    id: (id: string) => `${PRIVATE}/expense/${id}`,
  },
};
