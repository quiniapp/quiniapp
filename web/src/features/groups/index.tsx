import { UsersIcon, Users2Icon } from 'lucide-react';

import Box from '@/components/box';
import { Flex, FlexCol } from '@/components/flex';
import HeaderSection from '@/components/header-section';
import HeaderTitleSection from '@/components/header-title-section';
import { Button } from '@/components/ui/button.tsx';
import { Table, TableBody, TableHead, TableHeader } from '@/components/ui/table.tsx';

const UserGroupsContent = () => {
  return (
    <Box className={'grid grid-rows-[auto_1fr_auto] h-full  '}>
      <HeaderSection title={'Lista de Grupos'}>
        <Flex className={'justify-end gap-4'}>
          <Button variant={'outline'}> Nuevo Grupo</Button>
          <Button variant={'outline'}> Actualizar</Button>
        </Flex>
      </HeaderSection>
      <FlexCol className={'py-[36px]'}>
        <Box className={'grid grid-cols-2 gap-8'}>
          <FlexCol>
            <HeaderTitleSection
              title={'Grupo'}
              icon={<Users2Icon size="24px" />}
              variant={'lead'}
              className={'!mb-[36px]'}
            />
            <Flex className={'border border-dark-lighter rounded-lg overflow-hidden w-full'}>
              <Table>
                <TableHeader>
                  <TableHead>Numero</TableHead>
                  <TableHead> Nombre</TableHead>
                  <TableHead> descripción</TableHead>
                  <TableHead className={'text-right'}> Editar</TableHead>
                  <TableHead className={'text-right'}> Eliminar</TableHead>
                </TableHeader>
                <TableBody>
                  <p> list</p>
                </TableBody>
              </Table>
            </Flex>
          </FlexCol>
          <div>
            <HeaderTitleSection
              title={'Usuarios'}
              icon={<UsersIcon size="24px" />}
              variant={'lead'}
              className={'!mb-[36px]'}
            />{' '}
          </div>
        </Box>
      </FlexCol>
    </Box>
  );
};

export default UserGroupsContent;
