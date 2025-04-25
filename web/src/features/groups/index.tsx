import HeaderSection from '@/components/header-section';
import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';

const UserGroupsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Lista de Grupos'}>
        <Flex className={'justify-end'}>
          <button> boton 1</button>
          <button> boton 2</button>
        </Flex>
      </HeaderSection>
      <FlexCol>
<div> tabla grupos </div>
<div> tabla usuarios </div>
      </FlexCol>
    </Box>
  );
};

export default UserGroupsContent;
