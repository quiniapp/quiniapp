import { dispatchAuthExpired } from './authEvents';

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, { credentials: 'include', ...init });
  if (res.status === 401) {
    dispatchAuthExpired();
    throw new Error('Sesión expirada');
  }
  return res;
}
