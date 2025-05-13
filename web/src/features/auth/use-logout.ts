import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../helper/routes/routes.ts';

const logout = async () => {
  const response = await fetch(ROUTES.auth.logout, {
    method: 'POST',
    credentials: 'include', // <-- clave para que mande cookies
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
      // Si solo usás cookies, podés eliminar esto
      localStorage.removeItem('isAuth');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');

      queryClient.clear();
      navigate('/login');
    },
    onError: (error: Error) => {
      console.error('Error al cerrar sesión:', error.message);
    },
  });
};
