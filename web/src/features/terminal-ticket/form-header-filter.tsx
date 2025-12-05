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
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { USER_TYPE } from '@helper/types/user.type';

const FormHeaderFilter = () => {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: cashiers } = useUsers(role);
  const [inputValue, setInputValue] = useState('');

  const selectValue = searchParams.get('cashier_id') ?? undefined;

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);
    params.set('ticket_number', inputValue.trim());
    setSearchParams(params);
    setInputValue('');
  };

  const handleReset = () => {
    setInputValue('');
    searchParams.delete('ticket_number')
    setSearchParams(searchParams);
  };

  const handleSelectCashier = (id: string) => {
    if (searchParams.get('cashier_id') === id) searchParams.delete('cashier_id');
    else {
      searchParams.set('cashier_id', id);
    }
    setSearchParams(searchParams);
  };
  const handleSelectDate = (date?: string) => {
    setSearchParams({ date: date ?? dayjs().format('YYYY-MM-DD') });
  };
  const onChangeFilter = (value: string) => {
    searchParams.delete('ticket_number');
    searchParams.set('filter', value);
    setSearchParams(searchParams);
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
                defaultValue={undefined}
                value={selectValue}
                onValueChange={(value) => {
                  handleSelectCashier(value);
                }}
              >
                <SelectTrigger className={'border w-full '}>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {cashiers?.map((cashier) => {
                    return (
                      <SelectItem key={cashier.user_id} value={cashier.user_id}>
                        {cashier.name} - {cashier.number}
                      </SelectItem>
                    );
                  })}
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
            type="number"
            inputMode="numeric"
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
