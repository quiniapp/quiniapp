import HeaderSection from '@/components/header-section';
import InProgressSection from '@/components/in-progress-section';
import { PageWrapper } from '@/components/wrapper/PageWrapper';

const SettingsContent = () => {
  return (
    <PageWrapper>
      <HeaderSection title={'Configuración'} />
      <InProgressSection
        title={'Funcionalidad en desarrollo.'}
        text={'Estamos trabajando para habilitar esta sección en próximas actualizaciones.'}
        iconSize={120}
      />
    </PageWrapper>
  );
};

export default SettingsContent;
