import { ClockIcon } from "lucide-react";
// Components UI
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
// Components
import { Flex, FlexCol } from '@/components/flex';
import Box from "@/components/box";
import HeaderTitleSection from "@/components/header-title-section";
// Hooks
import { useKeyboardCheckboxes } from '@/hooks/useHotkeyCheckbox';


interface SchedulesProps {
  time: string
  schedule_id: string
  name: string
}

interface SchedulesCheckboxListProps {
  schedules: SchedulesProps[];
}

const KEY_LABELS = ['F1', 'F2', 'F3', 'F4', 'F5'];

const ScheduleCheckboxList = ({ schedules }: SchedulesCheckboxListProps) => {
  const { f1, f2, f3, f4, f5 } = useKeyboardCheckboxes();

  const keyboardMap = [f1, f2, f3, f4, f5];

  return (
    <FlexCol className="border-2 px-4 py-4 rounded-[--rounded-form]">
      <HeaderTitleSection title="Turnos" icon={<ClockIcon size="16px" />} variant="small" />
      <Box className="pt-2 grid grid-cols-5 gap-[12px]">
        {schedules.map((schedule, index) => {
          const keyHandler = keyboardMap[index];
          const keyLabel = KEY_LABELS[index];

          if (!keyHandler) return null;

          return (
            <Flex key={schedule.schedule_id} className="items-center gap-2">
              <Label htmlFor={`f${index + 1}`} className="text-[12px]">
                {schedule.name} <span className="text-primary-light">[{keyLabel}]</span>
              </Label>
              <Checkbox
                id={`f${index + 1}`}
                ref={keyHandler.ref}
                checked={keyHandler.checked}
                onCheckedChange={() => keyHandler.setChecked((prev) => !prev)}
                className="border-2 border-primary"
              />
            </Flex>
          );
        })}
      </Box>
    </FlexCol>
  );
}

export default ScheduleCheckboxList;