import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';


import { useSessionStore } from '../stores/sessionStore';
import { APIResponse } from '../../../helper/response/api_response.response.ts';
import { IUserEntityFront } from '../../../helper/types/user.type.ts';
import { ROUTES } from '../../routes/routes.ts';

interface FormData {
  username?: string;
  password?: string;
}

const loginRequest = async (data: FormData): Promise<APIResponse<IUserEntityFront>> => {
  const response = await fetch(ROUTES.auth.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.message || 'Login failed');
  }

  return response.json();
};

export const useLoginMutation = () => {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      if (data?.data?.user) {
        setSession(data.data.user);
        navigate('/');
      }
    },
    onError: (error: Error) => {
      console.error('Login error:', error.message);
    },
  });
};
