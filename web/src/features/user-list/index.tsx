import Box from '@/components/box';
import HeaderSection from '@/components/header-section';
import UsersListContent from '@/features/user-list/users-list-content.tsx';
import HeaderUserList from '@/features/user-list/header-user-list.tsx';

const UsersContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Listado de Usuarios'}>
        <HeaderUserList />
      </HeaderSection>
      <UsersListContent />
    </Box>
  );
};

export default UsersContent;
