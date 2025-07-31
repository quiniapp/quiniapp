import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes';
import { IUpdateUserEntity } from '../../../../../helper/request/user.response';

const updateUser = async (payload: IUpdateUserEntity) => {

  const { user_id, ...rest } = payload;
  const response = await fetch(ROUTES.user.id(user_id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // si usás auth por cookie
    body: JSON.stringify({ updateUser: rest }),
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
