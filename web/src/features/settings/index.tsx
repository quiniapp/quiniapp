import HeaderSection from '@/components/header-section';
import Box from '@/components/box';

const SettingsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Configuración'} />
      Configuration Page
    </Box>
  );
};

export default SettingsContent;
