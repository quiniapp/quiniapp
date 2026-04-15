import { Flex } from '@/components/flex';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from '@/components/ui/select';
import { Text } from '@/components/atoms/Text';
import { useLotteries } from '@/hooks/fetchs/lottery/useLotteries';
import { useSchedules } from '@/hooks/fetchs/schedule/useSchedules';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { useSearchParams } from 'react-router-dom';
import { useUsers } from '@/hooks/fetchs/users/useUsers';
import { useGroups } from '@/hooks/fetchs/organization/useGroups';
import { useGroupUsers } from '@/hooks/fetchs/users/useGroupUsers';
import { USER_TYPE } from '@helper/types/user.type';
import { Fragment } from 'react/jsx-runtime';
import { useAuth } from '@/contexts/AuthContext';

const ALL = 'Todos';

const PlayAndHitsSelect = () => {
  const { role, organizationId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: lotteries } = useLotteries();
  const { data: allUsers } = useUsers(role);
  const { data: schedules } = useSchedules();
  const { data: groups } = useGroups(organizationId, role);

  const selectedSchedule = searchParams.get('schedule_id');
  const selectedLottery = searchParams.get('lottery_id');
  const selectedCashier = searchParams.get('cashier_id');
  const selectedGroup = searchParams.get('group_id');

  const { data: groupUsers } = useGroupUsers(selectedGroup, role);
  const users = selectedGroup ? groupUsers : allUsers;

  const handleChange = (id: string, key: string) => {
    const params = new URLSearchParams(searchParams);
    if (id === ALL) params.delete(key);
    else params.set(key, id);
    setSearchParams(params);
  };

  const handleGroupChange = (id: string) => {
    const params = new URLSearchParams(searchParams);
    if (id === ALL) {
      params.delete('group_id');
    } else {
      params.set('group_id', id);
    }
    params.delete('cashier_id');
    setSearchParams(params);
  };

  return (
    <Flex className="p-1 items-center justify-center flex-wrap gap-x-6 gap-y-4 w-full">
      {role !== USER_TYPE.CASHIER && (
        <Fragment>
          <Flex className={'flex-1 gap-3 items-center'}>
            <Text className='text-base font-bold'>Pasador</Text>
            <Select
              value={selectedCashier ?? ''}
              onValueChange={(value) => {
                handleChange(value, 'cashier_id');
              }}
            >
              <SelectTrigger className={'border w-full bg-[var(--bg-card)]'}>
                <SelectValue placeholder={ALL} className='text-white'/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}> {ALL}</SelectItem>
                {users?.map((user) => {
                  return (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.name} - {user.number}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Flex>
          <Flex className={'flex-1 gap-3 items-center'}>
            <Text className='text-base font-bold'>Grupo</Text>
            <Select
              value={selectedGroup ?? ''}
              onValueChange={handleGroupChange}
            >
              <SelectTrigger className={'border w-full bg-[var(--bg-card)]'}>
                <SelectValue placeholder={ALL} className='text-white'/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{ALL}</SelectItem>
                {groups?.map((g) => (
                  <SelectItem key={g.organization_id} value={g.organization_id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Flex>
        </Fragment>
      )}
      <Flex className={'flex-1 gap-3 items-center'}>
        <Text className='text-base font-bold'>Turno</Text>
        <Select
          value={selectedSchedule ?? ''}
          onValueChange={(value) => {
            handleChange(value, 'schedule_id');
          }}
        >
          <SelectTrigger className={'border   w-full  bg-[var(--bg-card)]'}>
            <SelectValue placeholder={ALL}  className='text-white '/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}  className='text-white font-bold' > {ALL}</SelectItem>
            {schedules?.map((item: IScheduleEntityFront) => (
              <SelectItem key={item.schedule_id} value={item.schedule_id}  className='text-white font-bold' >
                {item.name} - {item.time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Flex>
      <Flex className={'flex-1 gap-3 items-center'}>
        <Text className='text-base font-bold'>Quniela</Text>
        <Select
        
          value={selectedLottery ?? ''}
          onValueChange={(value) => {
            handleChange(value, 'lottery_id');
          }}
        >
          <SelectTrigger className={'border  w-full bg-[var(--bg-card)] '}>
            <SelectValue placeholder={ALL}  />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}   className='text-white font-bold'  > {ALL}</SelectItem>
            {lotteries?.map((item: ILotteryEntityFront) => (
              <SelectItem  className='text-white font-bold'  key={item.lottery_id} value={item.lottery_id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Flex>
    </Flex>
  );
};

export default PlayAndHitsSelect;
