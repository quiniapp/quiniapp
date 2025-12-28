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
import { useUserListContext } from './UserListContext';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { useMemo } from 'react';

const HeaderUserList = () => {
  const navigate = useNavigate();
  const { setFilterUserType } = useUserListContext();
  const { role } = useAuth();

  // Determine available options based on user role
  const options = useMemo(() => {
    if (role === USER_TYPE.OWNER) {
      return [
        { value: USER_TYPE.CASHIER, label: 'PASADORES' },
        { value: USER_TYPE.SUPERADMIN, label: 'SUPERADMIN' },
        { value: USER_TYPE.ADMIN, label: 'ADMIN' },
        { value: 'TODOS', label: 'TODOS' }, 
      ];
    } else if (role === USER_TYPE.SUPERADMIN) {
      return [
        { value: USER_TYPE.CASHIER, label: 'PASADORES' },
        { value: USER_TYPE.ADMIN, label: 'ADMIN' },
        { value: 'TODOS', label: 'TODOS' },
      ];
    } else if (role === USER_TYPE.ADMIN) {
      return [{ value: USER_TYPE.CASHIER, label: 'PASADORES' }];
    }
    return [];
  }, [role]);

  const handleValueChange = (value: string) => {
    if (value === 'TODOS') {
      setFilterUserType(undefined);
    } else {
      setFilterUserType(value as USER_TYPE);
    }
  };

  return (
    <Flex className={'items-center gap-4'}>
      <Flex className={'gap-4 items-center'}>
        <Text size="sm" weight="medium">
          Tipo de usuario
        </Text>
        <Select
          value={USER_TYPE.CASHIER}
          onValueChange={handleValueChange}
        >
          <SelectTrigger className="w-[200px] bg-dark-light border-dark-lighter">
            <SelectValue placeholder="Tipo de Usuario" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
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
