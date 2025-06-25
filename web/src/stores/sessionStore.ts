import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IUserEntityFront, USER_TYPE } from '../../../helper/types/user.type';
import { ROUTES } from '../../routes/routes';

const EXPIRATION_TIME_MS = 60 * 60 * 1000; // 1 hora

interface SessionState {
  isAuth: boolean;
  user: IUserEntityFront | null;
  role: USER_TYPE | null;
  timestamp: number | null;
  setSession: (user: IUserEntityFront) => void;
  logout: () => void;
  validateSession: () => Promise<void>;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      isAuth: false,
      user: null,
      role: null,
      timestamp: null,

      setSession: (user) =>
        set({
          isAuth: true,
          user,
          role: user.user_type,
          timestamp: Date.now(),
        }),

      logout: () =>
        set({
          isAuth: false,
          user: null,
          role: null,
          timestamp: null,
        }),

      validateSession: async () => {
        const now = Date.now();
        const timestamp = get().timestamp;

        if (!timestamp || now - timestamp > EXPIRATION_TIME_MS) {
          return get().logout();
        }

        try {
          const res = await fetch(ROUTES.auth.validate, {
            credentials: 'include',
          });

          if (!res.ok) throw new Error('Token invalid or expired');
          const { data } = await res.json();

          if (data?.user) {
            get().setSession(data.user);
          } else {
            get().logout();
          }
        } catch (err) {
          get().logout();
        }
      },
    }),
    {
      name: 'auth-store',
      // 💡 rehidratación con expiración
      onRehydrateStorage: () => (state) => {
        const now = Date.now();
        if (state?.timestamp && now - state.timestamp > EXPIRATION_TIME_MS) {
          // 🧹 Sesión expirada
          state.logout(); // limpiar el store
        }
      },
    }
  )
);
