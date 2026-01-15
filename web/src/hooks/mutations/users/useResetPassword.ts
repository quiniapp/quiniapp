import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'react-hot-toast';

interface ResetPasswordPayload {
  userId: string;
  newPassword: string;
}

interface ResetPasswordResponse {
  password: string;
}

const resetPassword = async (payload: ResetPasswordPayload): Promise<ResetPasswordResponse> => {
  const response = await apiClient.post<ResetPasswordResponse>(
    BACKEND_ROUTES.user.resetPassword(payload.userId),
    { newPassword: payload.newPassword }
  );
  return response;
};

export const useResetPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      toast.success('Contraseña reseteada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.error?.message || 'Error al resetear la contraseña';
      toast.error(errorMessage);
    },
  });
};
