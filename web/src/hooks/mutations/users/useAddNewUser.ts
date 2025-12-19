import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { IUserEntityFront } from '@helper/types/user.type';
import { apiClient } from '@/lib/apiClient';

const addUser = async (newUser: Record<string, any>) => {
  return await apiClient.post<IUserEntityFront>(BACKEND_ROUTES.user.base, { newUser });
};

export const useAddNewUser = (
  options?: UseMutationOptions<IUserEntityFront, Error, Record<string, any>>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addUser,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
};