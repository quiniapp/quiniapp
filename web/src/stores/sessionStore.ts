import { create } from 'zustand';
import { IUserEntityFront, USER_TYPE } from '../../../helper/types/user.type.ts';


interface SessionState {
  isAuth: boolean;
  user: IUserEntityFront | null;
  role: USER_TYPE | null;
  setSession: (user: IUserEntityFront) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
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
}));
