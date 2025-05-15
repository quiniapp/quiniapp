
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ROUTES } from '../../../routes/routes.ts';
import { APIResponse } from '../../../../helper/response/api_response.response.ts';
import { IUserEntityFront, USER_TYPE } from '../../../../helper/types/user.type.ts';

interface FormData {
  username?: string;
  password?: string;
}

const login = async (data: FormData): Promise<APIResponse<IUserEntityFront>> => {
  const response = await fetch(ROUTES.auth.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    credentials: 'include',
  });
console.log(response)
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.message || 'Login failed');
  }

  return response.json();
};

export const useLogin = () => {
  const   navigate = useNavigate()
  return useMutation({
    mutationFn: login,
    onSuccess: (data: APIResponse<IUserEntityFront>) => {

      localStorage.setItem('user', JSON.stringify(data?.data?.user.username));

      localStorage.setItem('isAuth', 'true');
      navigate('/');
      if (data?.data?.user?.user_type === USER_TYPE.ADMIN) {
        localStorage.setItem('role', `${USER_TYPE.ADMIN}`);
      } else {
        localStorage.setItem('role', `${USER_TYPE.CASHIER}`);
      }

      return data;
    },
    onError: (error: Error) => {
      console.error('Error en el login:', error.message);
      // Aquí puedes agregar lógica para mostrar mensajes de error al usuario
    },
  });
};