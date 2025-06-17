import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { ROUTES } from '../../routes/routes.ts';

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

  return response.json();
};

export const useAddNewUser = (options?: UseMutationOptions<any, Error, Record<string, any>>) => {
  return useMutation({
    mutationFn: addUser,
    ...options,
  });
};
