import { Flex } from '@/components/flex';
import { Typography } from '@/components/typography';
import { Button } from '@/components/ui/button';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';


const HeaderUserList = () => {

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
