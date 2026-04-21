import { SearchIcon } from 'lucide-react';

import { Fieldset } from '@/components/fieldset';
import { Flex, FlexCol } from '@/components/flex';
import { IconButton } from '@/components/button/IconButton';
import { Input } from '@/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { Text } from '@/components/atoms/Text';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';

import IsRoleCashier from '@/components/is-role-cashier';
import { useEffect, useState } from 'react';
import { useUsers } from '@/hooks/fetchs/users/useUsers';
import { useGroups } from '@/hooks/fetchs/organization/useGroups';
import { useGroupUsers } from '@/hooks/fetchs/users/useGroupUsers';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';
import { useTerminalTicket } from './provider/TerminalTicketProvider';

const FormHeaderFilter = () => {
  const { role, organizationId, user } = useAuth();
  const { cashier_id, group_id, setDate, toggleCashier, setCashierId, setGroupId, setTicketNumber, resetTicketNumber, setFilter } = useTerminalTicket();
  const { data: allCashiers } = useUsers(role);
  const { data: groups } = useGroups(organizationId, role);
  const { data: groupUsers } = useGroupUsers(group_id ?? null, role);
  const cashiers = group_id ? groupUsers : allCashiers;
  const [inputValue, setInputValue] = useState('');

  const handleSearch = () => {
    const trimmed = inputValue.trim();
    const normalized =
      role === USER_TYPE.CASHIER && !trimmed.includes('-') && user?.number != null
        ? `${trimmed}-${user.number}`
        : trimmed;
    setTicketNumber(normalized);
    setInputValue('');
  };

  const handleReset = () => {
    setInputValue('');
    resetTicketNumber();
  };

  const handleSelectCashier = (id: string) => {
    if (id === '__all__') {
      setCashierId(undefined);
    } else {
      toggleCashier(id);
    }
  };

  const handleSelectDate = (date?: string) => {
    setDate(date);
  };

  const onChangeFilter = (value: 'all' | 'winner' | 'paid' | 'not_paid') => {
    setFilter(value);
  };

  useEffect(() => {
    handleSelectDate();
  }, []);
  return (
    <FlexCol className={'sm:flex-row mb-1 sm:mb-4 w-full gap-1 sm:gap-3'}>
      <Fieldset
        legend={role === USER_TYPE.CASHIER ? 'Seleccionar fecha' : 'Pasador:'}
        className={'w-full  flex gap-1 sm:gap-3'}
      >
        <FlexCol className={'w-full  space-y-4'}>
          <IsRoleCashier role={role}>
            <Flex className={' gap-3'}>
              <Select
                value={group_id ?? ''}
                onValueChange={(value) => setGroupId(value === 'Todos' ? undefined : value)}
              >
                <SelectTrigger className={'border w-full'}>
                  <SelectValue placeholder="Todos los grupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos los grupos</SelectItem>
                  {groups?.map((g) => (
                    <SelectItem key={g.organization_id} value={g.organization_id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={cashier_id ?? '__all__'}
                onValueChange={handleSelectCashier}
              >
                <SelectTrigger className={'border w-full '}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {cashiers?.map((cashier) => (
                    <SelectItem key={cashier.user_id} value={cashier.user_id}>
                      {cashier.name} - {cashier.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Flex>
          </IsRoleCashier>

          <Flex className={'w-full gap-2 justify-between'}>
            <SelectDayToSearch
              onDayChange={(value) => {
                handleSelectDate(value);
              }}
              toDate={dayjs().toDate()}
            />
            <Flex className={' items-center gap-3'}>

                <Text size="sm">Tickets</Text>

              <Select
                onValueChange={(value: 'all' | 'winner' | 'paid' | 'not_paid') => {
                  onChangeFilter(value);
                }}
              >
                <SelectTrigger className="border w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="winner">Con aciertos</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                  <SelectItem value="not_paid">No Pagados</SelectItem>
                </SelectContent>
              </Select>
            </Flex>
          </Flex>
        </FlexCol>
      </Fieldset>

      <Fieldset legend="Buscar por número de Ticket:" className="w-full  flex gap-3">
        <FlexCol className="w-full gap-4">
          <Input
            type="text"
            className=""
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ej: 20250619..."
          />
          <Flex className="gap-4 w-full justify-between">
            <IconButton
              type="button"
              label="Buscar"
              icon={<SearchIcon />}
              onClick={handleSearch}
              className="!px-6"
            />
            <IconButton
              type="reset"
              label="Limpiar"
              variant="outline"
              onClick={handleReset}
              className="!px-6"
            />
          </Flex>
        </FlexCol>
      </Fieldset>
    </FlexCol>
  );
};

export default FormHeaderFilter;
