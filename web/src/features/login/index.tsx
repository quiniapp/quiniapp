import { Flex } from '@/components/flex';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button.tsx';
import { LogInIcon } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { usePlatform } from '@/hooks/use-platform.ts';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';

import { z } from 'zod';
import { useEffect } from 'react';
import Logo from '@/components/logo';

interface FormData {
  name: string;
}

const validationSchemaLogin = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .refine((val) => val === 'agustin', {
      message: 'El usuario debe ser "agustin"',
    }),
});

const LoginContent = () => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(validationSchemaLogin),
  });

  const platform = usePlatform();
  const navigate = useNavigate();

  const onSubmit = async (data: FormData) => {
    console.log(data);
    localStorage.setItem('isAuth', JSON.stringify({ name: data.name }));
    navigate('/');
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('https://quiniapp.onrender.com/api/private/user/7e5a3e6b-7a6c-4c53-9131-bcbe934c76c3', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        // body: JSON.stringify({ ... }) // Si tu endpoint espera un body, añadilo acá
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
      return data;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
    }
  };

  useEffect(()=> {
    fetchUsers()
  },[])

  return (
    <Flex className="h-screen">
      <Flex className="flex-1 items-center justify-center w-full">
        <img src={'/bg-login.svg'} alt={''} className={'w-[860px] h-[860px]'} />
      </Flex>
      <Flex className="flex-1 justify-center items-center gap-4 border-l-2">
        <Card className="bg-transparent w-[480px]">
          <CardHeader>
            <Flex className={'pb-[56px]'}>
             <Logo />
            </Flex>
            <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
            <CardDescription>Un nuevo día, nuevas oportunidades</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent>
              <Flex className="flex-col space-y-6 pt-4">
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <Flex className="flex-col space-y-4">
                      <Label>Nombre</Label>
                      <Input {...field} type="text" placeholder="Nombre de usuario" />
                      {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </Flex>
                  )}
                />
                <Flex className="flex-col space-y-4">
                  <Label>Contraseña</Label>
                  <Input type="password" placeholder="******" />
                </Flex>
              </Flex>
            </CardContent>
            <CardFooter className="justify-between pt-[48px]">
              <Button className="flex-1">
                <LogInIcon /> Iniciar Sesión
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
