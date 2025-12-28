import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import HeaderSection from '@/components/header-section';
import { PageWrapper } from '@/components/wrapper/PageWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGetUsedStorage } from '@/hooks/fetchs/settings/useGetUsedStorage';
import { useChangePassword } from '@/hooks/mutations/users/useChangePassword';
import { KeyRound } from 'lucide-react';

type UsageCard = {
  id: string;
  headline: string;
  subline?: string;
  usedPct: number;
};

const USAGE_CARDS: UsageCard[] = [
  { id: 'opt-5', headline: '3.2 GB usados de 7 GB', subline: '(45.7% usado)', usedPct: 46 },
];

type RetentionKey = 'last-month' | 'two-months' | 'three-months';

const SettingsContent = () => {
  const [retention, setRetention] = useState<RetentionKey>('last-month');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { role } = useAuth();

  const {data:usedStorage} = useGetUsedStorage()
  const { mutateAsync: changePassword, isPending: isChangingPassword } = useChangePassword();

  const handleCleanup = () => {
    const label =
      retention === 'last-month'
        ? 'Mes pasado'
        : retention === 'two-months'
          ? '2 meses'
          : '3 meses';

    const t = toast.loading('Borrando datos viejos… (mock)');
    setTimeout(() => {
      toast.success(`Se eliminaron datos del período: ${label} (mock)`, { id: t });
    }, 900);
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      toast.error('La contraseña actual es requerida');
      return;
    }
    if (!newPassword.trim()) {
      toast.error('La nueva contraseña es requerida');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    await changePassword({ currentPassword, newPassword });

    // Clear form on success
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const usedPercentage = useMemo(()=>{
    if(usedStorage)
    return String(usedStorage/7).slice(0,5)
  },[usedStorage])
  return (
    <PageWrapper>
      <HeaderSection title="Configuración" />

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 overflow-y-auto">
        {USAGE_CARDS.map((opt) => (
          <Card
            key={opt.id}
            className={`transition border 
             'border-border'
             bg-[#10121A] text-white`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg text-white">
                  Espacio en Base de Datos
                </CardTitle>
             
              </div>

            </CardHeader>

            <CardContent className="space-y-3 text-white">
              <div>
                <div className="text-xl font-semibold leading-6 text-white">{`${usedStorage} usados de 7 GB`}</div>
                {usedPercentage&&<div className="text-sm text-white/70">{`(${usedPercentage}% usado)`}</div>}
              </div>

              {usedPercentage&&<div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Uso del espacio</span>
                  <span>{usedPercentage}%</span>
                </div>
                <Progress value={+usedPercentage} className="h-2 bg-white/20" />
              </div>}
            </CardContent>

            <CardFooter className="flex gap-2">

          {/*     <Button variant="outline" className="text-white border-white">
                Detalles
              </Button> */}
            </CardFooter>
          </Card>
        ))}

        {/* Card de cambiar contraseña - Visible para todos */}
        <Card className="xl:col-span-1 md:col-span-2 bg-[#10121A] text-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              <CardTitle className="text-base sm:text-lg text-white">Cambiar Contraseña</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm text-white/80">
              Actualiza tu contraseña de acceso.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-white">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-white">
                Contraseña Actual
              </Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ingresa tu contraseña actual"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-white">
                Nueva Contraseña
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ingresa tu nueva contraseña"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">
                Confirmar Nueva Contraseña
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu nueva contraseña"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
              />
            </div>
          </CardContent>

          <CardFooter className="flex items-center gap-3">
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              className="w-full sm:w-auto bg-primary text-white"
            >
              {isChangingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
            </Button>
          </CardFooter>
        </Card>

        {/* Card de mantenimiento - Solo visible para OWNER */}
        {role === USER_TYPE.OWNER && (
        <Card className="xl:col-span-1 md:col-span-2 bg-[#10121A] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg text-white">Borrar datos (mock)</CardTitle>
            <CardDescription className="text-xs sm:text-sm text-white/80">
              Elimina datos antiguos para liberar espacio.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-white">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'last-month', label: 'Mes pasado' },
                { key: 'two-months', label: '2 meses' },
                { key: 'three-months', label: '3 meses' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRetention(key as RetentionKey)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    retention === key
                      ? 'bg-primary text-white border-primary'
                      : 'bg-transparent border-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-white/30 p-3">
              <div className="text-sm font-medium mb-1 text-white">Período seleccionado</div>
              <div className="text-xs text-white/70">
                {retention === 'last-month'
                  ? 'Mes pasado'
                  : retention === 'two-months'
                    ? '2 meses'
                    : '3 meses'}
                .
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center gap-3">
            <Button onClick={handleCleanup} className="w-full sm:w-auto bg-primary text-white">
              Borrar datos
            </Button>
            <span className="text-xs text-white/60">* Acción simulada solo para maquetado.</span>
          </CardFooter>
        </Card>
        )}
      </div>
    </PageWrapper>
  );
};

export default SettingsContent;
