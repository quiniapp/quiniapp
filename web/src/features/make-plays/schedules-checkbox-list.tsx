import { IScheduleEntityFront } from '@helper/types/schedule.type';
import SchedulesCheckboxListDesktop from './schedules-checkbox-list-desktop';
import SchedulesCheckboxListMobile from './schedules-checkbox-list-mobile';

interface SchedulesProps {
  time: string;
  schedule_id: string;
  name: string;
}

interface SchedulesCheckboxListProps {
  schedules: SchedulesProps[];
  setSchedules: (schedule: IScheduleEntityFront) => void;
  checkedSchedules: Map<string, IScheduleEntityFront>;
}

const ScheduleCheckboxList = ({
  schedules,
  setSchedules,
  checkedSchedules,
}: SchedulesCheckboxListProps) => {
  return (
    <>
      {/* Desktop / Tablet: con CheckboxSection y F-keys */}
      <div className="hidden sm:block">
        <SchedulesCheckboxListDesktop
          schedules={schedules}
          setSchedules={setSchedules}
          checkedSchedules={checkedSchedules}
        />
      </div>

      {/* Mobile: sin CheckboxSection para ahorrar espacio */}
      <div className="sm:hidden">
        <SchedulesCheckboxListMobile
          schedules={schedules}
          setSchedules={setSchedules}
          checkedSchedules={checkedSchedules}
        />
      </div>
    </>
  );
};

export default ScheduleCheckboxList;
