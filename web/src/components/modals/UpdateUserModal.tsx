import Modal from './custom-modal';
import { Flex, FlexCol } from '../flex';
import { Label } from '../ui/label';
import { IconButton } from '../button/IconButton';
import { CASHIER_TYPE, IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { IUpdateUserEntity } from '@helper/request/user.response';
import { Controller, useForm } from 'react-hook-form';
import { useMemo } from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useUpdateUser } from '@/hooks/mutations/users/useUpdateUser';
import { ErrorMessage } from '@/components/atoms/ErrorMessage';

interface UpdateUsersModalProps {
  isOpen: boolean;
  user?: IUserEntityFront;
  onClose: VoidFunction;
}

const UpdateUsersModal = ({ isOpen, onClose, user }: UpdateUsersModalProps) => {
  if (!isOpen) return null;
  const {
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<IUpdateUserEntity>({
    // resolver: zodResolver(UserSchema) as Resolver<INewUserEntityForm>,
    mode: 'onBlur',
    defaultValues: {
      user_id: user?.user_id,
      number: user?.number,
      phone: user?.phone,
      name: user?.name,
      user_type: user?.user_type,
      cashier_type: user?.user_type === USER_TYPE.CASHIER ? user?.cashier_type : undefined,
      fee: user?.user_type === USER_TYPE.CASHIER ? user?.fee : undefined,
      fee_plus: user?.user_type === USER_TYPE.CASHIER ? user?.fee_plus : undefined,
      username: user?.username,
      group_id: user?.group_id,
      last_name: user?.last_name,
      address: user?.address,
      disabled: user?.disabled,
    },
  });
  
  const { mutate: updateUser, isPending: isPendingUpdate } = useUpdateUser();

  const isAvailable = useMemo(() => {
    return watch('cashier_type') !== CASHIER_TYPE.STREET;
  }, [watch('cashier_type')]);

  const onSubmit = (formData:IUpdateUserEntity) => {

    
    updateUser(formData)

  };
  return (
    <Modal
      title={`Editar usuario ${user?.name} - ${user?.number}`}
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[95vw] sm:!max-w-[90vw] md:!max-w-[800px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <form onSubmit={handleSubmit(onSubmit)} className={'w-full py-2 sm:py-4 space-y-2 sm:space-y-4 px-2 sm:px-4'}>
        <FlexCol className="items-center pt-2 gap-2 sm:gap-4">
          <Flex className="items-center justify-center gap-2 sm:gap-3 flex-col sm:flex-row w-full">
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="number">Número de usuario</Label>
              <Controller
                name="number"
                control={control}
                render={({ field: { onChange, value, ...rest } }) => (
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
                )}
              />
              {errors.number?.message && (
                <ErrorMessage>{errors.number.message}</ErrorMessage>
              )}
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
                  <Select onValueChange={field.onChange} value={field?.value ?? ''}>
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
          </Flex>
          <Flex>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="fee">Comisión (%)</Label>
              <Controller
                name="fee"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value ?? ''}
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
                    value={field.value ?? ''}
                    id="fee_plus"
                    type="number"
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                )}
              />
            </FlexCol>
          </Flex>
          <Flex>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="name">Nombre</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input id={'username'} {...field} value={field.value ?? ''} />
                )}
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
                render={({ field }) => (
                  <Input id={'last_name'} {...field} value={field.value ?? ''} />
                )}
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
                render={({ field }) => (
                  <Input id={'address'} {...field} value={field.value ?? ''} />
                )}
              />
              {errors.address?.message && (
                <ErrorMessage>{errors.address.message}</ErrorMessage>
              )}
            </FlexCol>
          </Flex>

          <Flex>
            <FlexCol className={'w-full space-y-4'}>
              <Label htmlFor="phone">Teléfono</Label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <Input id={'phone'} type={'tel'} {...field} value={field.value ?? ''} />
                )}
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
                render={({ field }) => (
                  <Input id={'email'} type={'email'} {...field} value={field.value ?? ''} />
                )}
              />
              {errors.email?.message && (
                <ErrorMessage>{errors.email.message}</ErrorMessage>
              )}
            </FlexCol>
          </Flex>

          {isAvailable && (
            <Flex className={' space-x-4  '}>
              <FlexCol className={'w-full space-y-4'}>
                <Label htmlFor="username">Usuario</Label>
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <Input id={'username'} {...field} value={field.value ?? ''} />
                  )}
                />
                {errors.username?.message && (
                  <ErrorMessage>{errors.username.message}</ErrorMessage>
                )}
              </FlexCol>
            </Flex>
          )}
          <IconButton
            label={isPendingUpdate ? 'Editando...' : 'Editar'}
            variant="success"
            type="submit"
            disabled={isPendingUpdate}
            className="w-full"
          />
        </FlexCol>
      </form>
    </Modal>
  );
};

export default UpdateUsersModal;
