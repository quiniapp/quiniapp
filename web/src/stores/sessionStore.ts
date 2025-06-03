import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IUserEntityFront, USER_TYPE } from '../../../helper/types/user.type';

interface SessionState {
  isAuth: boolean;
  user: IUserEntityFront | null;
  role: USER_TYPE | null;
  setSession: (user: IUserEntityFront) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isAuth: false,
      user: null,
      role: null,

      setSession: (user) =>
        set({
          isAuth: true,
          user,
          role: user.user_type,
        }),

      logout: () =>
        set({
          isAuth: false,
          user: null,
          role: null,
        }),
    }),
    {
      name: 'auth-store',
    }
  )
);
