import { useQuery } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';

const fetchGroupUsers = async (groupId: string) => {
  const response = await fetch(`${BACKEND_ROUTES.user.base}?group_id=${encodeURIComponent(groupId)}`, {
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

export const useGroupUsers = (
  groupId: string | null,
  role: USER_TYPE | null
) => {
  return useQuery<IUserEntityFront[]>({
    queryKey: ['group-users', groupId],
    queryFn: () => fetchGroupUsers(groupId!),
    enabled: !!groupId && !!role && [USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(role),
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
};
