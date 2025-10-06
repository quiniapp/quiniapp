
import Modal from './custom-modal';
import { useEffect, useRef } from 'react';
import { RadioGroup } from '@radix-ui/react-radio-group';
import { Flex, FlexCol } from '../flex';
import { RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { Button } from '../ui/button';
type Shift = {
  schedule_id: string;
  name: string;
  time: string;
};

interface GenerateWinnersModalProps {
  isOpen: boolean
  schedules: IScheduleEntityFront[]
  onClose: VoidFunction
  onClick:VoidFunction
  setScheduleWinners:React.Dispatch<React.SetStateAction<string | undefined>>
  isPendingWinners: boolean
}

const GenerateWinnersModal = ({
  isOpen,
  schedules,
  onClose,
  onClick,
  setScheduleWinners,
  isPendingWinners,
}: GenerateWinnersModalProps) => {
  const refF1 = useRef<HTMLButtonElement>(null);
  const refF2 = useRef<HTMLButtonElement>(null);
  const refF3 = useRef<HTMLButtonElement>(null);
  const refF4 = useRef<HTMLButtonElement>(null);
  const refF5 = useRef<HTMLButtonElement>(null);

  const refF6 = useRef<HTMLButtonElement>(null);
  const refF7 = useRef<HTMLButtonElement>(null);
  const refF8 = useRef<HTMLButtonElement>(null);
  const refF9 = useRef<HTMLButtonElement>(null);
  const refF10 = useRef<HTMLButtonElement>(null);
  const keyMap: Record<string, number> = {
    F1: 0,
    F2: 1,
    F3: 2,
    F4: 3,
    F5: 4,
    F6: 5,
    F7: 6,
    F8: 7,
    F9: 8,
    F10: 9,
  };
  const keyboardMap = [
    { key: 'F1', ref: refF1 },
    { key: 'F2', ref: refF2 },
    { key: 'F3', ref: refF3 },
    { key: 'F4', ref: refF4 },
    { key: 'F5', ref: refF5 },
    { key: 'F6', ref: refF6 },
    { key: 'F7', ref: refF7 },
    { key: 'F8', ref: refF8 },
    { key: 'F9', ref: refF9 },
    { key: 'F10', ref: refF10 },
  ];

  const handleKeyDown = (e: KeyboardEvent) => {
    const index = keyMap[e.key];

    if (index !== undefined) {
      e.preventDefault();

      const ref = keyboardMap[index].ref;
      if (ref?.current) {
        ref.current.click();
      }
    }
  };
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  return (
    <Modal
      title="Generar ganadores"
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[980px] w-full m-auto bg-[#060813] pt-[36px]"
    >
        
      <RadioGroup onValueChange={setScheduleWinners} className='flex gap-5'>

          {schedules?.map((turno: Shift, index) => (
              <Flex key={turno.schedule_id} className=" h-[36px]  items-center space-x-4">
              <RadioGroupItem
                ref={keyboardMap[index]?.ref}
                id={turno.schedule_id}
                value={turno.schedule_id}
                className="border border-primary"
                />
              <Label
                htmlFor={turno.schedule_id}
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                {turno.name} [{turno.time}] [F{index + 1}]
              </Label>
            </Flex>
          ))}
      </RadioGroup>
      <FlexCol className='items-center pt-2'>

      <Button
        variant={'success'}
        className="  hover:bg-green-700 text-white"
        onClick={() => onClick()}
        >
        {isPendingWinners ? 'Generando...' : 'Generar Ganadores'}
      </Button>
          </FlexCol>

    </Modal>
  );
};

export default GenerateWinnersModal;
