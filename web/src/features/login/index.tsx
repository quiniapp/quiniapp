// src/features/login/index.tsx (o donde esté LoginContent)
import { useEffect } from 'react';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { LogInIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';

import { Flex } from '@/components/flex';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePlatform } from '@/hooks/use-platform';
import { ROUTES } from '@/types/routes.type';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorMessage } from '@/components/atoms/ErrorMessage';

interface FormData {
  username: string;
  password: string;
}

const validationSchemaLogin = z.object({
  username: z.string().min(1, 'El nombre es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const LoginContent = () => {
  const { login, isAuth, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const platform = usePlatform();

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(validationSchemaLogin),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await login({ username: data.username, password: data.password });
      navigate(ROUTES.MAKE_PLAYS, { replace: true });
    } catch (err) {
      // Mostrar mensaje de error al usuario
      const errorMessage = err instanceof Error ? err.message : 'Error al iniciar sesión';
      toast.error(errorMessage);
      console.error('Error en el login:', err);
    }
  };

  // Redirigir si el usuario ya está autenticado
  useEffect(() => {
    if (isAuth) {
      navigate(ROUTES.MAKE_PLAYS, { replace: true });
    }
  }, [isAuth, navigate]);

  return (
    <Flex className="h-screen flex-col md:flex-row">
      {!isMobile && (
        <Flex className="flex-1 items-center justify-center w-full hidden md:flex">
          <img src={'/bg-login.svg'} alt={''} className={' w-[200px] md:w-[860px] md:h-[860px]'} loading="lazy" />
        </Flex>
      )}

      <Flex className="flex-1 justify-center items-center gap-4 border-l-2">
        <Card className="bg-transparent w-[480px]">
          <CardHeader>
            <Flex className={'pb-[56px]'}><Logo /></Flex>
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
                      <Label>Nombre</Label>
                      <Input {...field} type="text" placeholder="Nombre de usuario" autoComplete="username" />
                      {errors.username?.message && (
                        <ErrorMessage>{errors.username.message}</ErrorMessage>
                      )}
                    </Flex>
                  )}
                />
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <Flex className="flex-col space-y-4">
                      <Label>Contraseña</Label>
                      <Input {...field} type="password" placeholder="******" autoComplete="current-password" />
                      {errors.password?.message && (
                        <ErrorMessage>{errors.password.message}</ErrorMessage>
                      )}
                    </Flex>
                  )}
                />
              </Flex>
            </CardContent>
            <CardFooter className="justify-between pt-[48px]">
              <Button className="flex-1" type="submit" disabled={loading}>
                <LogInIcon /> {loading ? 'Iniciando Sesión…' : 'Iniciar Sesión'}
              </Button>
              {platform === 'desktop' && <Button variant="outline" type="button">Cancelar</Button>}
            </CardFooter>
          </form>
        </Card>
      </Flex>
    </Flex>
  );
};

export default LoginContent;
