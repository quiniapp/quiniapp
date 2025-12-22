import  { Fragment, useMemo } from 'react';
import { Flex, FlexCol } from '../flex';
import { Controller, ControllerProps, FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form';
import { Input } from '../ui/input';
import { Label } from '@radix-ui/react-label';
import { BanIcon, Box, SaveIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { USER_TYPE } from '@helper/types/user.type';
import { CASHIER_TYPE } from '@helper/types/user.type';
import { Button } from '../ui/button';
import { ErrorMessage } from '@/components/atoms/ErrorMessage';
import { Text } from '../atoms/Text';
interface UserFormProps<T extends FieldValues> {
  methods: UseFormReturn;
  onSubmit: SubmitHandler<T>;
  loading?: boolean;
  onCancel?: VoidFunction;
}
export const UserForm = <T extends FieldValues,>({ methods, onSubmit, loading, onCancel }: UserFormProps<T>) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = methods;

  const isAvailable = useMemo(() => {
    return watch('cashier_type') !== CASHIER_TYPE.STREET;
  }, [watch('cashier_type')]);
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
                      <>
                        <Input
                          id="number"
                          type="number"
                          value={value ?? ''}
                          onChange={(e) => {
                            const parsed = e.target.value === '' ? null : Number(e.target.value);
                            onChange(parsed);
                          }}
                          {...rest}
                        />
                        {errors.number?.message && (
                          <ErrorMessage>{errors.number.message}</ErrorMessage>
                        )}
                      </>
                    )}
                  />
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
                  {errors.user_type?.message && (
                    <ErrorMessage>{errors.user_type.message}</ErrorMessage>
                  )}
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
                  {errors.cashier_type?.message && (
                    <ErrorMessage>{errors.cashier_type.message}</ErrorMessage>
                  )}
                </FlexCol>
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
                    render={({ field }) => <Input id={'name'} {...field} />}
                  />
                  {errors.name?.message && (
                    <ErrorMessage>{errors.name.message}</ErrorMessage>
                  )}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="last_name">Apellido</Label>
                  <Controller
                    name="last_name"
                    control={control}
                    render={({ field }) => <Input id={'last_name'} {...field} />}
                  />
                  {errors.last_name?.message && (
                    <ErrorMessage>{errors.last_name.message}</ErrorMessage>
                  )}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="address">Dirección</Label>
                  <Controller
                    name="address"
                    control={control}
                    render={({ field }) => <Input id={'address'} {...field} />}
                  />
                  {errors.address?.message && (
                    <ErrorMessage>{errors.address.message}</ErrorMessage>
                  )}
                </FlexCol>
              </Flex>

              <Flex className={'gap-[24px] '}>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => <Input id={'phone'} type={'tel'} {...field} />}
                  />
                  {errors.phone?.message && (
                    <ErrorMessage>{errors.phone.message}</ErrorMessage>
                  )}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="email">Email</Label>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => <Input id={'email'} type={'email'} {...field} />}
                  />
                  {errors.email?.message && (
                    <ErrorMessage>{errors.email.message}</ErrorMessage>
                  )}
                </FlexCol>
              </Flex>
            </FlexCol>
          </fieldset>

          {isAvailable && (
            <fieldset className={'border px-4 py-4'}>
              <legend className={' px-4'}> Datos Inicio de sesion</legend>
              <Flex className={' space-x-4  '}>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="username">Usuario</Label>
                  <Controller
                    name="username"
                    control={control}
                    render={({ field }) => <Input id={'username'} {...field} />}
                  />
                  {errors.username?.message && (
                    <ErrorMessage>{errors.username.message}</ErrorMessage>
                  )}
                </FlexCol>
                <FlexCol className={'w-full space-y-4'}>
                  <Label htmlFor="password">Contraseña</Label>
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => <Input id={'password'} type={'text'} {...field} />}
                  />
                  {errors.password?.message && (
                    <ErrorMessage>{errors.password.message}</ErrorMessage>
                  )}
                </FlexCol>
              </Flex>
            </fieldset>
          )}
        </FlexCol>
      </Flex>

      <Box className={'grid grid-cols-2 gap-4 justify-between px-6 '}>
        <Button type="submit" className={'hover:cursor-pointer hover:bg-[--primary-800]'}>
          <Flex className={'items-center gap-4'}>
            <SaveIcon />
            <Text size="sm" weight="medium">
              {isPending ? 'Guardando' : 'Guardar Nuevo Usuario'}
            </Text>
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
            <Text size="sm" weight="medium">Borrar</Text>
          </Flex>
        </Button>
      </Box>
    </form>
  );
};

interface InputFormProps<T extends FieldValues> extends ControllerProps<T> {
  label: string;
}

const InputForm = ({onChange , onBlur, onClick , value, }) => {
  return (
    <Fragment>
      <Input
        id="number"
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const parsed = e.target.value === '' ? null : Number(e.target.value);
          onChange(parsed);
        }}
        {...rest}
      />
      {errors.number?.message && (
        <ErrorMessage>{errors.number.message}</ErrorMessage>
      )}
    </Fragment>
  );
};
