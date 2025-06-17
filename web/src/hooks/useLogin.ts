import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/stores/sessionStore';
// Components
import { ROUTES } from '../../routes/routes';
// Helpers
import { IUserEntityFront } from '../../../helper/types/user.type';
import { APIResponse } from '../../../helper/response/api_response.response';

interface FormData {
  username?: string;
  password?: string;
}

const loginRequest = async (data: FormData): Promise<APIResponse<{ user: IUserEntityFront }>> => {
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
  const setSession = useSessionStore((s) => s.setSession);

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: ({ data }) => {
      if (data?.user) {
        // @ts-ignore
        setSession(data?.user);
        navigate('/');
      }
    },
    onError: (error: Error) => {
      console.error('Login error:', error.message);
    },
  });
};
