import UserListAddNewUserForm from '@/features/user-list/user-list-form.tsx';
import Box from '@/components/box';
import HeaderSection from '@/components/header-section';

const NewUserContent = () => {
  return (
    <Box>
      <HeaderSection title={'Crear nuevo usuario'} />
      <UserListAddNewUserForm />
    </Box>
  );
};

export default NewUserContent;
