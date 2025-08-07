import { Flex, FlexCol } from '@/components/flex';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from '@/components/ui/select';
import { TypographyMuted } from '@/components/ui/typography-muted';
import { useLotteries } from '@/hooks/useLotteries';
import { useSchedules } from '@/hooks/useSchedules';
import { IScheduleEntityFront } from 'helper/types/schedule.type';
import { ILotteryEntityFront } from '../../../../helper/types/lottery.type';
import { useSearchParams } from 'react-router-dom';
import { useUsers } from '@/hooks/fetchs/users/useUsers';
import { useSessionStore } from '@/stores/sessionStore';
import { USER_TYPE } from '../../../../helper/types/user.type';
import { Fragment } from 'react/jsx-runtime';

const ALL = 'Todos';

const PlayAndHitsSelect = () => {
  const { role } = useSessionStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: lotteries } = useLotteries();
  const { data } = useUsers();
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
    <Flex className={' space-x-4'}>
      {role !== USER_TYPE.CASHIER && (
        <Flex className={'flex-1 space-x-4'}>
          <Fragment>
            <FlexCol className={'flex-1 gap-3'}>
              <TypographyMuted label={'Pasador'} />
              <Select
                value={selectedCashier ?? ''}
                onValueChange={(value) => {
                  handleChange(value, 'cashier_id');
                }}
              >
                <SelectTrigger className={'border w-full 1440:py-[24px] bg-[var(--bg-card)]'}>
                  <SelectValue placeholder={ALL} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}> {ALL}</SelectItem>
                  {data?.map(user=>{
                    return(

                      <SelectItem value={user.user_id}>{user.name} - {user.number}</SelectItem>
                    )
                  })}
                  
                </SelectContent>
              </Select>
            </FlexCol>
            <FlexCol className={'flex-1 gap-3'}>
              <TypographyMuted label={'Grupo'} />
              <Select>
                <SelectTrigger className={'border w-full   bg-[var(--bg-card)]'}>
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
            </FlexCol>
          </Fragment>
        </Flex>
      )}
      <Flex className={'flex-1 space-x-4'}>
        <Flex className={'flex-1 gap-3'}>
          <FlexCol className={'flex-1 gap-3'}>
            <TypographyMuted label={'Turno'} />
            <Select
              value={selectedSchedule ?? ''}
              onValueChange={(value) => {
                handleChange(value, 'schedule_id');
              }}
            >
              <SelectTrigger className={'border w-full   bg-[var(--bg-card)]'}>
                <SelectValue placeholder={ALL} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}> {ALL}</SelectItem>
                {schedules?.data?.schedule?.map((item: IScheduleEntityFront) => (
                  <SelectItem key={item.schedule_id} value={item.schedule_id}>
                    {item.name} - {item.time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FlexCol>
        </Flex>
        <Flex className={'flex-1 gap-3'}>
          <FlexCol className={'flex-1 gap-3'}>
            <TypographyMuted label={'Quniela'} />
            <Select
              value={selectedLottery ?? ''}
              onValueChange={(value) => {
                handleChange(value, 'lottery_id');
              }}
            >
              <SelectTrigger className={'border w-full   bg-[var(--bg-card)]'}>
                <SelectValue placeholder={ALL} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}> {ALL}</SelectItem>
                {lotteries?.data?.lottery?.map((item: ILotteryEntityFront) => (
                  <SelectItem key={item.lottery_id} value={item.lottery_id}>
                    {' '}
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FlexCol>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default PlayAndHitsSelect;
