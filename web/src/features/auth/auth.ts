
import { useMutation } from '@tanstack/react-query';

interface FormData {
  email?: string;
  password?: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role?: 'superadmin' | 'pasador';
  };
}

const login = async (data: FormData): Promise<LoginResponse> => {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
console.log(response)
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.message || 'Login failed');
  }

  return response.json();
};

export const useLogin = () => {
  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user?.role === 'superadmin') {
        localStorage.setItem('role', 'superadmin');
      } else {
        localStorage.setItem('role', 'pasador');
      }
      console.log(data)
      // Ya no navegamos aquí
      return data;
    },
    onError: (error: Error) => {
      console.error('Error en el login:', error.message);
      // Aquí puedes agregar lógica para mostrar mensajes de error al usuario
    },
  });
};