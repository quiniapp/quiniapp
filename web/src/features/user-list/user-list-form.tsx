import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button';
import { BanIcon, SaveIcon } from 'lucide-react';
import { Label } from '@/components/ui/label.tsx';
import { Typography } from '@/components/typography';
import Box from '@/components/box';

interface FormValues {
  pinNumber: string;
  pinType?: string;
  group?: string;
  name: string;
  lastName: string;
  address?: string;
  phone?: string;
  email?: string;
}

const formSchema = z.object({
  pinNumber: z
    .string()
    .min(4, { message: 'El número de pasador debe tener al menos 4 caracteres.' }),
  pinType: z.string().optional(),
  group: z.string().optional(),
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
  lastName: z.string().min(2, { message: 'El apellido debe tener al menos 2 caracteres.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: 'Ingrese un correo electrónico válido.' }).optional(),
});

export default function MyForm() {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pinNumber: '',
      pinType: '',
      group: '',
      name: '',
      lastName: '',
      address: '',
      phone: '',
      email: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    console.log(values);
    console.log('click');
  };

  const useResetForm = () => {
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={'w-full bg-[--bg-card] py-4 space-y-4 '}>
      <Flex className={'w-full  py-8 px-6 rounded-lg overflow-hidden'}>
        <FlexCol className={'w-full space-y-8'}>
          <FlexCol className={'w-full space-y-4'}>
            <Label htmlFor="pinNumber">Número de usuario</Label>
            <Controller
              name="pinNumber"
              control={control}
              render={({ field }) => (
                <Input id={'pinNumber'} placeholder="Ej: juancarlos" {...field} />
              )}
            />
            {errors.pinNumber && <p className="text-red-600">{errors.pinNumber.message}</p>}
          </FlexCol>
          <Flex className={'gap-[24px]'}>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="pinType">Tipo de pasador</Label>
              <Controller
                name="pinType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full bg-[var(--bg-card)] border-dark-lighter">
                      <SelectValue placeholder="Seleccione uno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={'option1'}>Opción 1</SelectItem>
                      <SelectItem value={'option2'}>Opción 2</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.pinType && <p className="text-red-600">{errors.pinType.message}</p>}
            </FlexCol>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="group">Grupo</Label>
              <Controller
                name="group"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full bg-[var(--bg-card)] border-dark-lighter">
                      <SelectValue placeholder="Seleccione uno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={'groupA'}>Grupo A</SelectItem>
                      <SelectItem value={'groupB'}>Grupo B</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.group && <p className="text-red-600">{errors.group.message}</p>}
            </FlexCol>
          </Flex>
          <Flex className={'gap-[24px]'}>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="name">Nombre</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => <Input id={'name'} placeholder="Juan" {...field} />}
              />
              {errors.name && <p className="text-red-600">{errors.name.message}</p>}
            </FlexCol>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="lastName">Apellido</Label>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => <Input id={'lastName'} placeholder="Gonzalez" {...field} />}
              />
              {errors.lastName && <p className="text-red-600">{errors.lastName.message}</p>}
            </FlexCol>
          </Flex>
          <FlexCol className={'w-full space-y-4'}>
            <Label htmlFor="address">Dirección</Label>
            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <Input id={'address'} placeholder="Av. Siempre viva 742" {...field} />
              )}
            />
            {errors.address && <p className="text-red-600">{errors.address.message}</p>}
          </FlexCol>
          <Flex className={'gap-[24px]'}>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="phone">Teléfono</Label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => <Input id={'phone'} type={'tel'} placeholder="+541155550000" {...field} />}
              />
              {errors.phone && <p className="text-red-600">{errors.phone.message}</p>}
            </FlexCol>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="email">Email</Label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input id={'email'} type={'email'} placeholder="juancarlos@mail.com" {...field} />
                )}
              />
              {errors.email && <p className="text-red-600">{errors.email.message}</p>}
            </FlexCol>
          </Flex> </FlexCol>
      </Flex>
      <Box className={'grid grid-cols-2 gap-4 justify-between px-6 '}>
        <Button type="submit" className={'hover:cursor-pointer hover:bg-[#151C47]'}>
          <Flex className={'items-center gap-4'}>
            <SaveIcon />
            <Typography variant={'small'}> Guardar Nuevo Usuario</Typography>
          </Flex>
        </Button>
        <Button
          type="reset"
          className={ 'hover:cursor-pointer w-full bg-[--card-foreground] hover:bg-[--card-foreground / 2]' }
          onClick={useResetForm}
        >
          <Flex className={'items-center gap-4'}>
            <BanIcon />
            <Typography variant={'small'}>Borrar</Typography>
          </Flex>
        </Button>
      </Box>
    </form>
  );
}
