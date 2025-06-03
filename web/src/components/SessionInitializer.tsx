// ✅ SessionInitializer.tsx
import { useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSessionStore } from '@/stores/sessionStore';

export const SessionInitializer = () => {
  const { data, isSuccess, isError } = useCurrentUser();
  const setSession = useSessionStore((state) => state.setSession);
  const markInitialized = useSessionStore((state) => state.markInitialized);

  useEffect(() => {
    if (isSuccess && data?.data?.user) {
      setSession(data.data.user);
    } else if (isError) {
      markInitialized(); // usuario no logueado o error → igual continuar
    }
  }, [isSuccess, isError, data]);

  return null;
};
