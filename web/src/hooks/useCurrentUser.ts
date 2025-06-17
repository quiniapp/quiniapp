import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '@/stores/sessionStore';

import { APIResponse } from '../../../helper/response/api_response.response.ts';
import { IUserEntityFront } from '../../../helper/types/user.type.ts';
import { ROUTES } from '../../routes/routes.ts';

const fetchCurrentUser = async (): Promise<APIResponse<IUserEntityFront>> => {
  const userId = useSessionStore.getState().user?.user_id;

  if (!userId) throw new Error('No hay ID de usuario en sesión');

  const response = await fetch(ROUTES.user.id(userId), {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) throw new Error('No autorizado');
  return response.json();
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
