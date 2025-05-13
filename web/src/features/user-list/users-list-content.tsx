import Box from '@/components/box';
import UsersTable from '@/features/user-list/user-table.tsx';


const UsersListContent = () => {
  return (
    <Box className={'rounded-xl w-full overflow-hidden py-[24px] space-x-8 grid grid-cols-12'}>
      <Box className={'col-start-1 col-end-13 row-span-1'}>
        <Box className={'row-start-1 row-end-2'}>
          <UsersTable />
        </Box>
      </Box>
    </Box>
  );
};

export default UsersListContent;
