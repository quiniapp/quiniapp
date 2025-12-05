import { Flex } from '@/components/flex';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ROUTES } from '@/types/routes.type.ts';

const HeaderUserList = () => {
  const navigate = useNavigate();
  return (
    <Flex className={'items-center gap-4'}>
      <Flex className={'gap-4 items-center'}>
        <Text size="sm" weight="medium">Tipo de usuario</Text>
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
      <Button
        className={'!hover:cursor-pointer bg-[--primary-800]'}
        type={'button'}
        variant={'outline'}
        onClick={() => navigate(ROUTES.NEW_USER)}
      >
        Crear nuevo
      </Button>
    </Flex>
  );
};

export default HeaderUserList;
