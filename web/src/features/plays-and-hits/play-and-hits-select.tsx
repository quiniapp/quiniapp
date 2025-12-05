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
import { USER_TYPE } from '@helper/types/user.type';
import { Fragment } from 'react/jsx-runtime';
import { useAuth } from '@/contexts/AuthContext';

const ALL = 'Todos';

const PlayAndHitsSelect = () => {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: lotteries } = useLotteries();
  const { data } = useUsers(role);
  const { data: schedules } = useSchedules();

  const selectedSchedule = searchParams.get('schedule_id');
  const selectedLottery = searchParams.get('lottery_id');
  const selectedCashier = searchParams.get('cashier_id');

  const handleChange = (id: string, key: string) => {
    const params = new URLSearchParams(searchParams);
    if (id === ALL) params.delete(key);
    else params.set(key, id);
    setSearchParams(params);
  };

  return (
    <Flex className="p-1 items-center justify-center flex-wrap gap-x-6 gap-y-4 w-full">
      {role !== USER_TYPE.CASHIER && (
        <Fragment>
          <Flex className={'flex-1 gap-3 items-center'}>
            <Text size="sm">Pasador</Text>
            <Select
              value={selectedCashier ?? ''}
              onValueChange={(value) => {
                handleChange(value, 'cashier_id');
              }}
            >
              <SelectTrigger className={'border w-full bg-[var(--bg-card)]'}>
                <SelectValue placeholder={ALL} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}> {ALL}</SelectItem>
                {data?.map((user) => {
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
            <Text size="sm">Grupo</Text>
            <Select>
              <SelectTrigger className={'border   w-full  bg-[var(--bg-card)]'}>
                <SelectValue placeholder={ALL} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}> {ALL}</SelectItem>
                <SelectItem value={'Pasador 1'}> Grupo 1</SelectItem>
                <SelectItem value={'Pasador 2'}> Grupo 2</SelectItem>
                <SelectItem value={'Pasador 4'}> Grupo 4</SelectItem>
                <SelectItem value={'Pasador 5'}> Grupo 5</SelectItem>
              </SelectContent>
            </Select>
          </Flex>
        </Fragment>
      )}
      <Flex className={'flex-1 gap-3 items-center'}>
        <Text size="sm">Turno</Text>
        <Select
          value={selectedSchedule ?? ''}
          onValueChange={(value) => {
            handleChange(value, 'schedule_id');
          }}
        >
          <SelectTrigger className={'border   w-full  bg-[var(--bg-card)]'}>
            <SelectValue placeholder={ALL} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}> {ALL}</SelectItem>
            {schedules?.map((item: IScheduleEntityFront) => (
              <SelectItem key={item.schedule_id} value={item.schedule_id}>
                {item.name} - {item.time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Flex>
      <Flex className={'flex-1 gap-3 items-center'}>
        <Text size="sm">Quniela</Text>
        <Select
          value={selectedLottery ?? ''}
          onValueChange={(value) => {
            handleChange(value, 'lottery_id');
          }}
        >
          <SelectTrigger className={'border  w-full bg-[var(--bg-card)]'}>
            <SelectValue placeholder={ALL} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}> {ALL}</SelectItem>
            {lotteries?.map((item: ILotteryEntityFront) => (
              <SelectItem key={item.lottery_id} value={item.lottery_id}>
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
