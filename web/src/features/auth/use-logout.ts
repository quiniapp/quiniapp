import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const logout = async () => {
  const token = localStorage.getItem('token');

  const response = await fetch('http://localhost:3000/api/private/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    // body: JSON.stringify({}), // Si tu API espera un body
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