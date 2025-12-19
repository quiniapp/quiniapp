import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUpdateUserEntity } from '@helper/request/user.request';
import { IUserEntityFront } from '@helper/types/user.type';
import { apiClient } from '@/lib/apiClient';

const updateUser = async (payload: IUpdateUserEntity) => {
  const { user_id, ...rest } = payload;
  return await apiClient.put<IUserEntityFront>(BACKEND_ROUTES.user.id(user_id), {
    updateUser: rest,
  });
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
