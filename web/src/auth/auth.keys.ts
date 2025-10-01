

// src/auth/auth.keys.ts
export const authKeys = {
  root: ['auth'] as const,
  me: () => [...authKeys.root, 'me'] as const,
};
