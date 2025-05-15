import { zodResolver } from '@hookform/resolvers/zod';
import { BanIcon, SaveIcon } from 'lucide-react';
import { Controller, useForm, Resolver } from 'react-hook-form';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddNewUserFormValues } from '@/types/user.type.ts';
import { addNewUserSchema } from '@/validations/useAddNewUser.validation.ts';

export default function UserListAddNewUserForm() {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AddNewUserFormValues>({
    resolver: zodResolver(addNewUserSchema) as Resolver<AddNewUserFormValues>,
    mode: 'onBlur',
    defaultValues: {
      pinNumber: '',
      pinType: '',
      group: '',
      name: '',
      lastName: '',
      address: '',
      phone: '',
      email: '',
      user: '',
      password: '',
      commission: 0,
      spread: 0,
    },
  });

  const onSubmit = (values: AddNewUserFormValues) => {
    console.log(values);
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
                  <Label htmlFor="pinNumber">Número de usuario</Label>
                  <Controller
                    name="pinNumber"
                    control={control}
                    render={({ field }) => (
                      <Input id={'pinNumber'} type={'number'} placeholder="Ej: 344223" {...field} />
                    )}
                  />
                  {errors.pinNumber && <p className="text-red-600">{errors.pinNumber.message}</p>}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="pinType">Tipo de pasador</Label>
                  <Controller
                    name="pinType"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full border-dark-lighter">
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
              </Box>
              <Box className={'gap-[24px] px-[12px] grid grid-cols-2'}>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="commission">Comisión (%)</Label>
                  <Controller
                    name="commission"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="commission"
                        type="number"
                        onChange={(e) => field.onChange(e.target.valueAsNumber)} // 👈 clave
                        placeholder="0"
                      />
                    )}
                  />
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="spread">Deje (%)</Label>
                  <Controller
                    name="spread"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="spread"
                        type="number"
                        onChange={(e) => field.onChange(e.target.valueAsNumber)} // 👈 clave
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
                  <Label htmlFor="lastName">Apellido</Label>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <Input id={'lastName'} placeholder="Gonzalez" {...field} />
                    )}
                  />
                  {errors.lastName && <p className="text-red-600">{errors.lastName.message}</p>}
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
                <Label htmlFor="user">Usuario</Label>
                <Controller
                  name="user"
                  control={control}
                  render={({ field }) => <Input id={'user'} placeholder="juancarlos" {...field} />}
                />
                {errors.user && <p className="text-red-600">{errors.user.message}</p>}
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
            <Typography variant={'small'}> Guardar Nuevo Usuario</Typography>
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
