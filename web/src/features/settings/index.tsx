import { useMemo } from 'react';
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

import { useGetUsedStorage } from '@/hooks/fetchs/settings/useGetUsedStorage';
import { useCleanupOldData } from '@/hooks/mutations/settings/useCleanupOldData';

type UsageCard = {
  id: string;
  headline: string;
  subline?: string;
  usedPct: number;
};

const USAGE_CARDS: UsageCard[] = [
  { id: 'opt-5', headline: '3.2 GB usados de 7 GB', subline: '(45.7% usado)', usedPct: 46 },
];

const SettingsContent = () => {
  const { role } = useAuth();

  const { data: usedStorage } = useGetUsedStorage();
  const { mutate: cleanupOldData, isPending: isCleaningUp } = useCleanupOldData();

  const handleCleanup = () => {
    cleanupOldData(undefined, {
      onSuccess: (data) => {
        toast.success(
          `Limpieza completada: ${data.bets_deleted} apuestas y ${data.tickets_deleted} tickets eliminados.`,
        );
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Error al limpiar datos');
      },
    });
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


        {/* Card de mantenimiento - Solo visible para OWNER */}
        {role === USER_TYPE.OWNER && (
          <Card className="xl:col-span-1 md:col-span-2 bg-[#10121A] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg text-white">Borrar datos</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-white/80">
                Elimina apuestas y tickets de archivo con más de 65 días de antigüedad.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-white">
              <div className="rounded-lg border border-white/30 p-3">
                <div className="text-sm font-medium mb-1 text-white">Datos a eliminar</div>
                <div className="text-xs text-white/70">
                  Registros de <code>bets_archive</code> y <code>tickets_archive</code> con fecha
                  anterior a los últimos 65 días.
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center gap-3">
              <Button
                onClick={handleCleanup}
                disabled={isCleaningUp}
                className="w-full sm:w-auto bg-primary text-white"
              >
                {isCleaningUp ? 'Limpiando...' : 'Borrar datos'}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
};

export default SettingsContent;
