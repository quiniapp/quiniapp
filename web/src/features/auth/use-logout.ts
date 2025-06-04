import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes/routes';
import { useSessionStore } from '@/stores/sessionStore';

const logout = async () => {
  const response = await fetch(ROUTES.auth.logout, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.message || 'Logout failed');
  }

  return response.json();
};

export const useLogout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      useSessionStore.getState().logout();
      queryClient.clear();
      navigate('/login');
    },
    onError: (error: Error) => {
      console.error('Logout error:', error.message);
    },
  });
};
