import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { toast } from 'react-hot-toast';

interface UnlockUserParams {
  userId: string;
}

const unlockUser = async ({ userId }: UnlockUserParams): Promise<void> => {
  await apiClient.post(`${BACKEND_ROUTES.user.base}/unlock/${userId}`);
};

export const useUnlockUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario desbloqueado exitosamente');
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Error al desbloquear usuario';
      toast.error(errorMessage);
    },
  });
};
