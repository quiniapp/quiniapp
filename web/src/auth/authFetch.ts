// src/auth/authFetch.ts

import { queryClient } from '@/pages/App';
import { authKeys } from './auth.keys';

let logoutFn: null | (() => Promise<void>) = null;
export const bindGlobalLogout = (fn: () => Promise<void>) => (logoutFn = fn);

export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, {
    credentials: 'include',
    ...init,
  });
  if (res.status === 401) {
    // invalidar estado de auth inmediatamente
    await queryClient.setQueryData(authKeys.me(), { data: { user: undefined } });
    if (logoutFn) await logoutFn();
    throw new Error('Not authenticated');
  }
  return res;
}
