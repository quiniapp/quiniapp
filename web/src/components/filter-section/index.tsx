import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';

import Box from '@/components/box';
import { Flex } from '@/components/flex';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectDayToSearch } from '@/components/button/SelectDayToSearch';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext.tsx';
import { useGetUserByNumber } from '@/hooks/fetchs/users/useUsersByNumber.ts';
import { useGroups } from '@/hooks/fetchs/organization/useGroups.ts';
import { USER_TYPE } from '@helper/types/user.type';

const FilterSection = () => {
  const [userNumber, setUserNumber] = useState<string>('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const isMobile = useIsMobile();
  const { role, organizationId } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') ?? undefined;
  const group_id = searchParams.get('group_id') ?? undefined;

  const { data: groups } = useGroups(organizationId, role);

  // No pises otros params al setear la fecha
  const handleDayChange = (newDate?: string) => {
    if (!newDate) return;
    const params = new URLSearchParams(searchParams);
    params.set('date', newDate);
    setSearchParams(params);
  };

  const handleGroupChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'Todos') {
      params.delete('group_id');
    } else {
      params.set('group_id', value);
    }
    setSearchParams(params);
  };

  // Si tu hook admite "enabled", mejor: pero por compatibilidad dejamos el parseo acá
  const userNumberInt = useMemo(
    () => (userNumber.trim() === '' ? 0 : Number.parseInt(userNumber, 10) || 0),
    [userNumber]
  );
  const { data } = useGetUserByNumber(userNumberInt);

  const showGroupAndCashierFilters = role !== USER_TYPE.CASHIER;

  return (
    <Box className="bg-[var(--primary-bg-content)] text-white p-1 sm:p-3">
      {isMobile && (
        <Flex className="justify-between items-center mb-2">
          <button
            type="button"
            className="flex items-center bg-[#2A3042] px-3 py-1 rounded"
            onClick={() => setIsFilterExpanded((s) => !s)}
          >
            <Filter size={16} className="mr-2" />
            {isFilterExpanded ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
        </Flex>
      )}

      <Box
        className={`${
          isMobile && !isFilterExpanded ? 'hidden' : 'flex'
        } flex-col md:flex-row flex-wrap gap-[36px] items-start md:items-center`}
      >
        <Flex className="items-center">
          <Label className="text-sm mr-2 text-muted-foreground">A la Fecha:</Label>
          <SelectDayToSearch
            selectedDay={date}
            onDayChange={handleDayChange}
            toDate={dayjs().toDate()}
          />
        </Flex>

        {showGroupAndCashierFilters && (
          <>
            <Flex className="items-center">
              <Label className="text-sm text-muted-foreground mr-2">Grupo:</Label>
              <Box>
                <Select value={group_id ?? 'Todos'} onValueChange={handleGroupChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar Grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    {groups?.map((g) => (
                      <SelectItem key={g.organization_id} value={g.organization_id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Box>
            </Flex>

            <Flex className="items-center gap-1 sm:gap-3">
              <Label htmlFor="employee_number" className="text-sm  text-muted-foreground">
                Pasador:
              </Label>
              <Input
                id="employee_number"
                type="text"
                className="border bg-card-bg rounded text-sm w-28"
                inputMode="numeric"
                value={userNumber}
                onChange={(e) => setUserNumber(e.currentTarget.value)}
                // Si querés solo dígitos: onChange={(e)=> setUserNumber(e.currentTarget.value.replace(/\D/g,''))}
              />
              <Label htmlFor="employee_number" className="text-sm  text-muted-foreground">
                {data?.name} {data?.number}
              </Label>
            </Flex>
          </>
        )}
      </Box>
    </Box>
  );
};

export default FilterSection;
