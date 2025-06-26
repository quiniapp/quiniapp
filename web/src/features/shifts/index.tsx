import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import InProgressSection from '@/components/in-progress-section';

const ShiftsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr] 1440:grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Turnos'} />
      <InProgressSection
        title={'Funcionalidad en desarrollo.'}
        text={'Estamos trabajando para habilitar esta sección en próximas actualizaciones.'}
        iconSize={120}
      />
    </Box>
  );
};

export default ShiftsContent;
