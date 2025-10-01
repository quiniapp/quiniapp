import { useMutation,  useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';

const deleteUsers = async (id:string) => {
  const response = await fetch(BACKEND_ROUTES.user.id(id), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // si usás auth por cookie
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
};

export const useDeleteUsers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUsers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
