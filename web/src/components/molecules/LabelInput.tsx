
import { Flex } from '../flex';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface LabelInputProps {
  title: string;
  value: string;
}

const LabelInput = ({ title, value }: LabelInputProps) => {
  return (
    <Flex className='p-1 gap-1  sm:gap-4'>
      <Label className="text-white text-center text-nowrap text-xs sm:text-sm">{title}</Label>
      <Input /> 
    </Flex>
  );
};

export default LabelInput;
