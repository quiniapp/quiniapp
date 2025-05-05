import { Flex } from '@/components/flex';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Typography } from '@/components/typography';
import { useState } from 'react';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import UserListAddNewUserForm from '@/features/user-list/user-list-form.tsx';
import { XIcon } from 'lucide-react';

const HeaderUserList = () => {
  const [open, setOpen] = useState(false);

  const DrawerContentProfile = () => {
    return (
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger asChild>
          <Button>Nuevo Usuario</Button>
        </DrawerTrigger>

        <DrawerContent className="!max-w-[800px] !w-[800px] ml-auto bg-[var(--background)] p-8">
          <DrawerHeader className="text-left relative">
            <DrawerTitle>Crear nuevo usuario</DrawerTitle>
            <DrawerDescription>
              Make changes to your profile here. Click save when you're done.
            </DrawerDescription>
            <div className={'absolute right-0'}>
              <DrawerClose asChild>
                <Button variant="outline" size={'icon'}>
                  <XIcon />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <UserListAddNewUserForm />
        </DrawerContent>
      </Drawer>
    );
  };
  return (
    <Flex className={'items-center gap-4'}>
      <Flex className={'gap-4 items-center'}>
        <Typography variant={'small'}>Tipo de usuario </Typography>
        <Select defaultValue="TODOS">
          <SelectTrigger className="w-[200px] bg-dark-light border-dark-lighter">
            <SelectValue placeholder="Tipo de Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">TODOS</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="USER">Usuario</SelectItem>
          </SelectContent>
        </Select>
      </Flex>
      <DrawerContentProfile />

      <Button
        className={'!hover:cursor-pointer bg-[--primary-800]'}
        type={'button'}
        variant={'outline'}
      >
        Actualizar
      </Button>
    </Flex>
  );
};

export default HeaderUserList;
