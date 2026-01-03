import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';

const fetchAssignableUsers = async (excludeGroupId?: string) => {
  const response = await fetch(BACKEND_ROUTES.user.assignable(excludeGroupId), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  const { data } = await response.json();
  return data.users;
};

export const useAssignableUsers = (
  role: USER_TYPE | null,
  excludeGroupId?: string
) => {
  return useQuery<IUserEntityFront[]>({
    queryKey: ['assignable-users', excludeGroupId],
    queryFn: () => fetchAssignableUsers(excludeGroupId),
    enabled: !!role && [USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(role),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
};
