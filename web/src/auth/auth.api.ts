// src/auth/auth.api.ts
import { IUserEntityFront } from '@helper/types/user.type';
import { BACKEND_ROUTES } from '../../routes/routes';

type ApiUser = { data?: { user?: IUserEntityFront } }; // tipá con IUserEntityFront si querés
type LoginPayload = { username?: string; password?: string };

export async function authMe(): Promise<ApiUser> {
  const res = await fetch(BACKEND_ROUTES.auth.validate, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export async function authLogin(payload: LoginPayload): Promise<ApiUser> {
  const res = await fetch(BACKEND_ROUTES.auth.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || 'Login failed');
  }
  return res.json();
}

export async function authLogout(): Promise<void> {
  const res = await fetch(BACKEND_ROUTES.auth.logout, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || 'Logout failed');
  }
}
