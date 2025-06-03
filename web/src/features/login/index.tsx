import { useEffect } from 'react';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom'; // Importa el hook useLogin
import { useForm, Controller } from 'react-hook-form';
import { LogInIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';


import { Flex } from '@/components/flex';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePlatform } from '@/hooks/use-platform';

import { ROUTES } from '../../../routes/routes';
import { useLoginMutation } from '@/hooks/useLogin';
import { useSessionStore } from '@/stores/sessionStore';

interface FormData {
  username: string;
  password: string;
}

const validationSchemaLogin = z.object({
  username: z.string().min(1, 'El nombre es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const LoginContent = () => {
  const isAuth = useSessionStore((state) => state.isAuth);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(validationSchemaLogin),
  });

  const platform = usePlatform();


  const { mutateAsync: loginMutationAsync, isPending, isError, error } = useLoginMutation();

  const onSubmit = async (data: FormData) => {
    try {
      await loginMutationAsync({ username: data.username, password: data.password });
    } catch (error) {
      console.error('Error en el login:', error);
      // El error ya se está manejando en el onError del useMutation,
      // pero podrías agregar lógica adicional aquí si es necesario.
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(ROUTES.user.base, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // body: JSON.stringify({ ... }) // Si tu endpoint espera un body, añadilo acá
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('data---->', data);

      return data;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
    }
  };

  useEffect(() => {
    if (isAuth) {
      navigate('/', { replace: true });  
    }
  }, [isAuth]);
  
  useEffect(() => {
    fetchUsers();
  }, []);

  
  return (
    <Flex className="h-screen flex-col md:flex-row">
      {!isMobile && (
        <Flex className="flex-1 items-center justify-center w-full hidden md:flex">
          <img src={'/bg-login.svg'} alt={''} className={' w-[200px] md:w-[860px] md:h-[860px]'} />
        </Flex>
      )}

      <Flex className="flex-1 justify-center items-center gap-4 border-l-2">
        <Card className="bg-transparent w-[480px]">
          <CardHeader>
            <Flex className={'pb-[56px]'}>
              <Logo />
            </Flex>
            <CardTitle className="text-2xl text-white">Iniciar Sesión</CardTitle>
            <CardDescription>Un nuevo día, nuevas oportunidades</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent>
              <Flex className="flex-col space-y-6 pt-4">
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <Flex className="flex-col space-y-4">
                      <Label className={'text-white'}>Nombre</Label>
                      <Input {...field} type="text" placeholder="Nombre de usuario" />
                      {errors.username && (
                        <p className="text-red-500 text-sm">{errors.username.message}</p>
                      )}
                    </Flex>
                  )}
                />
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <Flex className="flex-col space-y-4">
                      <Label className={'text-white'}>Contraseña</Label>
                      <Input {...field} type="password" placeholder="******" />
                      {errors.password && (
                        <p className="text-red-500 text-sm">{errors.password.message}</p>
                      )}
                    </Flex>
                  )}
                />
                {isError && <p className="text-red-500 text-sm">Error: {error?.message}</p>}
              </Flex>
            </CardContent>
            <CardFooter className="justify-between pt-[48px]">
              <Button className="flex-1" type="submit" disabled={isPending}>
                <LogInIcon /> {isPending ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
              </Button>
              {platform === 'desktop' && <Button variant="outline">Cancelar</Button>}
            </CardFooter>
          </form>
        </Card>
      </Flex>
    </Flex>
  );
};

export default LoginContent;
