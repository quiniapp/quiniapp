export const AUTH_EXPIRED_EVENT = 'auth:expired';

export const dispatchAuthExpired = () => {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
};
