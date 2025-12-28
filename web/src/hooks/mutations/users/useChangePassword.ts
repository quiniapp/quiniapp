import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { BACKEND_ROUTES } from '../../../../routes/routes';

interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

interface ChangePasswordResponse {
  success: boolean;
}

const changePassword = async (payload: ChangePasswordPayload): Promise<ChangePasswordResponse> => {
  const response = await apiClient.post<ChangePasswordResponse>(
    BACKEND_ROUTES.user.changePassword,
    payload
  );
  return response;
};

export const useChangePassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast.success('Contraseña cambiada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error: any) => {
      toast.error(error?.error?.message || 'Error al cambiar la contraseña');
    },
  });
};
