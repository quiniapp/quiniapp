import HeaderSection from '@/components/header-section';
import Box from '@/components/box';

const CurrentAccountContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Cuenta Corriente'} />
      Cuenta Corriente
    </Box>
  );
};

export default CurrentAccountContent;
