import {
  BanIcon,
  SaveIcon,
  UserCircle2,
  Building2,
  Shield,
  Mail,
  Phone,
  MapPin,
  Hash,
  Percent,
  Key,
  User
} from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { Flex, FlexCol } from '@/components/flex';
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '@/components/ui/card';
// @@helpers

// @Hooks
import { useAddNewUser } from '@/hooks/mutations/users/useAddNewUser.ts';

import { toast } from 'react-hot-toast';
import { useMemo } from 'react';
import { CASHIER_TYPE, USER_TYPE } from '@helper/types/user.type';
import { ErrorMessage } from '@/components/atoms/ErrorMessage';
import { Text } from '@/components/atoms/Text';
import { INewUserEntity } from '@helper/request/user.request';

export default function UserListAddNewUserForm() {
  const {
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<INewUserEntity>({
    // resolver: zodResolver(UserSchema) as Resolver<INewUserEntityForm>,
    mode: 'onBlur',
    defaultValues: {
      number: null,
      name: '',
      user_type: USER_TYPE.CASHIER,
      cashier_type: CASHIER_TYPE.PC,
      fee: 0,
      fee_plus: 0,
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

  const onSubmit = (data: INewUserEntity) => {
    addUser(data);
  };

  const useResetForm = () => {
    reset();
  };
  const isAvailable = useMemo(() => {
    return watch('cashier_type') !== CASHIER_TYPE.STREET;
  }, [watch('cashier_type')]);

  const isAdmin = useMemo(() => {
    return watch('user_type') === USER_TYPE.ADMIN;
  }, [watch('user_type')]);

  const selectedUserType = watch('user_type');
  const shouldShowNumberField = useMemo(() => {
    return selectedUserType === USER_TYPE.ADMIN || selectedUserType === USER_TYPE.CASHIER;
  }, [selectedUserType]);
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Datos de Aplicación */}
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <Flex className="items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Datos de Aplicación</CardTitle>
              <CardDescription>Configuración del usuario en el sistema</CardDescription>
            </div>
          </Flex>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primera fila - Información básica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {shouldShowNumberField && (
              <FlexCol className="space-y-2">
                <Label htmlFor="number" className="flex items-center gap-2 text-sm font-medium">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Número de usuario
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Controller
                  name="number"
                  control={control}
                  rules={{
                    required: 'El número es requerido para usuarios ADMIN y CASHIER',
                  }}
                  render={({ field: { onChange, value, ...rest } }) => (
                    <Input
                      id="number"
                      type="number"
                      placeholder="Ej: 1001"
                      className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                      value={value ?? ''}
                      onChange={(e) => {
                        const parsed = e.target.value === '' ? null : Number(e.target.value);
                        onChange(parsed);
                      }}
                      {...rest}
                    />
                  )}
                />
                {errors.number?.message && <ErrorMessage>{errors.number.message}</ErrorMessage>}
              </FlexCol>
            )}

            <FlexCol className="space-y-2">
              <Label htmlFor="user_type" className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Tipo de usuario
              </Label>
              <Controller
                name="user_type"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10 text-white transition-all focus:ring-2 focus:ring-primary/20">
                      <SelectValue placeholder="Seleccione el tipo" className="text-white" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={USER_TYPE.ADMIN}>👑 Admin</SelectItem>
                      <SelectItem value={USER_TYPE.CASHIER}>💼 Cajero</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.user_type?.message && (
                <ErrorMessage>{errors.user_type.message}</ErrorMessage>
              )}
            </FlexCol>

            <FlexCol className="space-y-2">
              <Label htmlFor="cashier_type" className="flex items-center gap-2 text-sm font-medium">
                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                Tipo de pasador
              </Label>
              <Controller
                name="cashier_type"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                    disabled={isAdmin}
                  >
                    <SelectTrigger
                      className="h-10 text-white transition-all focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SelectValue placeholder="Seleccione el tipo" className="text-white" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CASHIER_TYPE.STREET}>🚶 Calle</SelectItem>
                      <SelectItem value={CASHIER_TYPE.PC}>💻 PC</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cashier_type?.message && (
                <ErrorMessage>{errors.cashier_type.message}</ErrorMessage>
              )}
            </FlexCol>
          </div>

          {/* Segunda fila - Comisiones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 pt-4 border-t">
            <FlexCol className="space-y-2">
              <Label htmlFor="fee" className="flex items-center gap-2 text-sm font-medium">
                <Percent className="h-4 w-4 text-muted-foreground" />
                Comisión
              </Label>
              <Controller
                name="fee"
                control={control}
                render={({ field: { value, onChange, ...rest } }) => (
                  <div className="relative">
                    <Input
                      {...rest}
                      id="fee"
                      type="number"
                      placeholder="0.00"
                      className="h-10 pr-8 transition-all focus:ring-2 focus:ring-primary/20"
                      value={value ?? ''}
                      onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                )}
              />
            </FlexCol>

            <FlexCol className="space-y-2">
              <Label htmlFor="fee_plus" className="flex items-center gap-2 text-sm font-medium">
                <Percent className="h-4 w-4 text-muted-foreground" />
                Deje
              </Label>
              <Controller
                name="fee_plus"
                control={control}
                render={({ field: { value, onChange, ...rest } }) => (
                  <div className="relative">
                    <Input
                      {...rest}
                      id="fee_plus"
                      type="number"
                      placeholder="0.00"
                      className="h-10 pr-8 transition-all focus:ring-2 focus:ring-primary/20"
                      value={value ?? ''}
                      onChange={(e) => onChange(e.target.valueAsNumber || 0)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                )}
              />
            </FlexCol>
          </div>
        </CardContent>
      </Card>

      {/* Datos Personales */}
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <Flex className="items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <User className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Datos Personales</CardTitle>
              <CardDescription>Información de contacto del usuario</CardDescription>
            </div>
          </Flex>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primera fila - Nombre y apellido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <FlexCol className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                Nombre
              </Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    id="name"
                    placeholder="Ingrese el nombre"
                    className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                    {...field}
                  />
                )}
              />
              {errors.name?.message && <ErrorMessage>{errors.name.message}</ErrorMessage>}
            </FlexCol>

            <FlexCol className="space-y-2">
              <Label htmlFor="last_name" className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                Apellido
              </Label>
              <Controller
                name="last_name"
                control={control}
                render={({ field: { value, ...rest } }) => (
                  <Input
                    id="last_name"
                    placeholder="Ingrese el apellido"
                    className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                    value={value ?? ''}
                    {...rest}
                  />
                )}
              />
              {errors.last_name?.message && (
                <ErrorMessage>{errors.last_name.message}</ErrorMessage>
              )}
            </FlexCol>

            <FlexCol className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="address" className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Dirección
              </Label>
              <Controller
                name="address"
                control={control}
                render={({ field: { value, ...rest } }) => (
                  <Input
                    id="address"
                    placeholder="Ingrese la dirección"
                    className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                    value={value ?? ''}
                    {...rest}
                  />
                )}
              />
              {errors.address?.message && <ErrorMessage>{errors.address.message}</ErrorMessage>}
            </FlexCol>
          </div>

          {/* Segunda fila - Contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <FlexCol className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Teléfono
              </Label>
              <Controller
                name="phone"
                control={control}
                render={({ field: { value, ...rest } }) => (
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Ej: +54 11 1234-5678"
                    className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                    value={value ?? ''}
                    {...rest}
                  />
                )}
              />
              {errors.phone?.message && <ErrorMessage>{errors.phone.message}</ErrorMessage>}
            </FlexCol>

            <FlexCol className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Controller
                name="email"
                control={control}
                render={({ field: { value, ...rest } }) => (
                  <Input
                    id="email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                    value={value ?? ''}
                    {...rest}
                  />
                )}
              />
              {errors.email?.message && <ErrorMessage>{errors.email.message}</ErrorMessage>}
            </FlexCol>
          </div>
        </CardContent>
      </Card>

      {/* Datos de Inicio de Sesión - Solo si está disponible */}
      {isAvailable && (
        <Card className="transition-shadow hover:shadow-md border-green-200 dark:border-green-900">
          <CardHeader>
            <Flex className="items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Key className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle>Datos de Inicio de Sesión</CardTitle>
                <CardDescription>Credenciales de acceso al sistema</CardDescription>
              </div>
            </Flex>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <FlexCol className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Usuario
                </Label>
                <Controller
                  name="username"
                  control={control}
                  render={({ field: { value, ...rest } }) => (
                    <Input
                      id="username"
                      placeholder="Nombre de usuario"
                      className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                      value={value ?? ''}
                      {...rest}
                    />
                  )}
                />
                {errors.username?.message && (
                  <ErrorMessage>{errors.username.message}</ErrorMessage>
                )}
              </FlexCol>

              <FlexCol className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  Contraseña
                </Label>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="password"
                      type="text"
                      placeholder="Ingrese la contraseña"
                      className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                      {...field}
                    />
                  )}
                />
                {errors.password?.message && (
                  <ErrorMessage>{errors.password.message}</ErrorMessage>
                )}
              </FlexCol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botones de Acción */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 h-11 bg-primary hover:bg-primary/90 transition-all hover:shadow-lg disabled:opacity-50"
        >
          <Flex className="items-center justify-center gap-2">
            <SaveIcon className="h-4 w-4" />
            <Text size="sm" weight="medium">
              {isPending ? 'Guardando...' : 'Guardar Nuevo Usuario'}
            </Text>
          </Flex>
        </Button>
        <Button
          type="reset"
          variant="outline"
          onClick={useResetForm}
          disabled={isPending}
          className="flex-1 sm:flex-initial sm:min-w-[180px] h-11 border-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all"
        >
          <Flex className="items-center justify-center gap-2">
            <BanIcon className="h-4 w-4" />
            <Text size="sm" weight="medium">
              Limpiar Formulario
            </Text>
          </Flex>
        </Button>
      </div>
    </form>
  );
}
