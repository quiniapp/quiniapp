import { useMemo } from 'react';
import { Fieldset } from '@/components/fieldset';
import { Flex, FlexCol } from '@/components/flex';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useLotteries } from '@/hooks/useLotteries';
import { IScheduleEntityFront } from '../../../../helper/types/schedule.type';

interface QuinielaFieldsetProps {
  legend: string;
  namePrefix: string;
  schedule: IScheduleEntityFront;
  availableLotteryIds: string[]; // habilitadas hoy para este turno
  selectedLotteryIds: Set<string>; // seleccionadas (controlado)
  onToggleLottery: (lotteryId: string) => void;
  onToggleAll: (checked: boolean) => void; // true = seleccionar todas
}

export const QuinielaFieldset = ({
  legend,
  namePrefix,
  schedule,
  availableLotteryIds,
  selectedLotteryIds,
  onToggleLottery,
  onToggleAll,
}: QuinielaFieldsetProps) => {
  const { data: lotteries } = useLotteries();

  const allSelected =
    availableLotteryIds.length > 0 && availableLotteryIds.every((id) => selectedLotteryIds.has(id));

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    lotteries?.forEach((l) => map.set(l.lottery_id, l.name));
    return map;
  }, [lotteries]);

  return (
    <Fieldset legend={legend}>
      <Flex className="items-center gap-2">
        <Checkbox
          id={`${namePrefix}-${schedule.schedule_id}-all`}
          checked={allSelected}
          onCheckedChange={(v) => onToggleAll(Boolean(v))}
          className="border-primary border"
        />
        <Label htmlFor={`${namePrefix}-${schedule.schedule_id}-all`}>Todas</Label>
      </Flex>

      <FlexCol className="gap-3 overflow-y-scroll py-[20px]">
        {availableLotteryIds.map((lotId) => {
          const inputId = `${namePrefix}-${lotId}`;
          const checked = selectedLotteryIds.has(lotId);
          const label = nameById.get(lotId) ?? lotId;

          return (
            <Flex key={inputId} className="items-center gap-2">
              <Checkbox
                id={inputId}
                name={inputId}
                className="border-primary border"
                checked={checked}
                onCheckedChange={() => onToggleLottery(lotId)}
              />
              <Label
                htmlFor={inputId}
                className="w-full hover:cursor-pointer hover:bg-[#ffffff11] py-1 transition-all ease-in-out"
              >
                {label}
              </Label>
            </Flex>
          );
        })}
      </FlexCol>
    </Fieldset>
  );
};
