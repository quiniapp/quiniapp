import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';

const addUser = async (newUser: Record<string, any>) => {
  const response = await fetch(ROUTES.user.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ newUser: newUser }),
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }

  return await response.json();
};

// --- Hook
export const useAddNewUser = (
  options?: UseMutationOptions<any, Error, Record<string, any>>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addUser,
    onSuccess: async (...args) => {
      // invalida users solo cuando sea necesario
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
};