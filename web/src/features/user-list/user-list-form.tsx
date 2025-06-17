import { zodResolver } from '@hookform/resolvers/zod';
import { BanIcon, SaveIcon } from 'lucide-react';
import { Controller, useForm, Resolver } from 'react-hook-form';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// @Helpers


import type { INewUserEntityForm } from '@/types/user.type';

// @Hooks
import { useAddNewUser } from '@/hooks/useAddNewUser';

import { toast } from 'react-hot-toast';
import { CASHIER_TYPE, USER_TYPE } from '@helper/types/user.type'
import { UserSchema } from '@helper/schemas/user.schema';


export default function UserListAddNewUserForm() {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<INewUserEntityForm>({
    resolver: zodResolver(UserSchema) as Resolver<INewUserEntityForm>,
    mode: 'onBlur',
    defaultValues: {
      number: 0,
      name: '',
      user_type: USER_TYPE.CASHIER,
      cashier_type: CASHIER_TYPE.PC,
      fee: undefined,
      fee_plus: undefined,
      username: '',
      password: '',
      group_id: '',
      last_name: '',
      address: '',
      phone: undefined,
      email: '',
    },
  });

  const { mutate: addUser, isPending } = useAddNewUser({
    onSuccess: () => {
      toast.success('✅ Usuario creado correctamente');
      reset();
    },
    onError: (error: any) => {
      toast.error(`❌ Error: ${error.message}`);
    },
  });

  const onSubmit = (data: INewUserEntityForm) => {
    addUser(data);
  };

  const useResetForm = () => {
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={'w-full   py-4 space-y-4 '}>
      <Flex className={'w-full  py-8 px-6 rounded-lg overflow-hidden'}>
        <FlexCol className={'w-full space-y-4'}>
          <fieldset className={'border px-4 py-4 flex flex-col gap-4'}>
            <legend className={' px-4'}> Datos Aplicación</legend>
            <Box className={'gap-[24px] p-[8px] grid grid-cols-[2fr_auto] items-center'}>
              <Box className={'gap-[24px] p-[12px] grid grid-cols-3'}>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="number">Número de usuario</Label>
                  <Controller
                    name="number"
                    control={control}
                    render={({ field: { onChange, value, ...rest } }) => (
                      <Input
                        id="number"
                        type="number"
                        placeholder="Ej: 344223"
                        value={value ?? ''}
                        onChange={(e) => {
                          const parsed = e.target.value === '' ? null : Number(e.target.value);
                          onChange(parsed);
                        }}
                        {...rest}
                      />
                    )}
                  />
                  {errors.number && <p className="text-red-600">{errors.number.message}</p>}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="user_type">Tipo de usuario</Label>
                  <Controller
                    name="user_type"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full border-dark-lighter">
                          <SelectValue placeholder="Seleccione uno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={USER_TYPE.ADMIN}>Admin</SelectItem>
                          <SelectItem value={USER_TYPE.CASHIER}>Cajero </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.user_type && <p className="text-red-600">{errors.user_type.message}</p>}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="cashier_type">Tipo de pasador</Label>
                  <Controller
                    name="cashier_type"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full border-dark-lighter">
                          <SelectValue placeholder="Seleccione uno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CASHIER_TYPE.STREET}>Calle</SelectItem>
                          <SelectItem value={CASHIER_TYPE.PC}>PC</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.cashier_type && (
                    <p className="text-red-600">{errors.cashier_type.message}</p>
                  )}
                </FlexCol>
                {/*
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="group">Grupo</Label>
                  <Controller
                    name="group"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full border-dark-lighter">
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
                */}
              </Box>
              <Box className={'gap-[24px] px-[12px] grid grid-cols-2'}>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="fee">Comisión (%)</Label>
                  <Controller
                    name="fee"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="fee"
                        type="number"
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        placeholder="0"
                      />
                    )}
                  />
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="fee_plus">Deje (%)</Label>
                  <Controller
                    name="fee_plus"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="fee_plus"
                        type="number"
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        placeholder="0"
                      />
                    )}
                  />
                </FlexCol>
              </Box>
            </Box>
          </fieldset>
          <fieldset className={'border px-4 py-4'}>
            <legend className={' px-4'}> Datos Personales</legend>
            <FlexCol className={'p-[12px] space-y-6'}>
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
                  <Label htmlFor="last_name">Apellido</Label>
                  <Controller
                    name="last_name"
                    control={control}
                    render={({ field }) => (
                      <Input id={'last_name'} placeholder="Gonzalez" {...field} />
                    )}
                  />
                  {errors.last_name && <p className="text-red-600">{errors.last_name.message}</p>}
                </FlexCol>
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
              </Flex>

              <Flex className={'gap-[24px] '}>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <Input id={'phone'} type={'tel'} placeholder="+541155550000" {...field} />
                    )}
                  />
                  {errors.phone && <p className="text-red-600">{errors.phone.message}</p>}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="email">Email</Label>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id={'email'}
                        type={'email'}
                        placeholder="juancarlos@mail.com"
                        {...field}
                      />
                    )}
                  />
                  {errors.email && <p className="text-red-600">{errors.email.message}</p>}
                </FlexCol>
              </Flex>
            </FlexCol>
          </fieldset>

          <fieldset className={'border px-4 py-4'}>
            <legend className={' px-4'}> Datos Inicio de sesion</legend>
            <Flex className={' space-x-4  '}>
              <FlexCol className={'w-full space-y-4'}>
                <Label htmlFor="username">Usuario</Label>
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <Input id={'username'} placeholder="juancarlos" {...field} />
                  )}
                />
                {errors.username && <p className="text-red-600">{errors.username.message}</p>}
              </FlexCol>
              <FlexCol className={'w-full space-y-4'}>
                <Label htmlFor="password">Contraseña</Label>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <Input id={'password'} type={'password'} placeholder="********" {...field} />
                  )}
                />
                {errors.password && <p className="text-red-600">{errors.password.message}</p>}
              </FlexCol>
            </Flex>
          </fieldset>
        </FlexCol>
      </Flex>

      <Box className={'grid grid-cols-2 gap-4 justify-between px-6 '}>
        <Button type="submit" className={'hover:cursor-pointer hover:bg-[--primary-800]'}>
          <Flex className={'items-center gap-4'}>
            <SaveIcon />
            <Typography variant={'small'}>
              {isPending ? 'Guardando' : 'Guardar Nuevo Usuario'}
            </Typography>
          </Flex>
        </Button>
        <Button
          type="reset"
          className={
            'hover:cursor-pointer w-full bg-[--card-foreground] hover:bg-[--card-foreground / 2]'
          }
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
