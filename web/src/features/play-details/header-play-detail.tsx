import Flex from '@/components/flex';

import HeaderSection from '@/components/header-section';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@radix-ui/react-label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const HeaderPlayDetail = () => {
  return (
    <HeaderSection title={'Realizar Jugadas'}>
      <Flex className={'h-[56px] items-center'}>
        <form>
          <Flex className={'gap-8'}>
            <Flex className={'items-center justify-center gap-4'}>
              <Label htmlFor={'user'}> Usuario</Label>
              <Input type={'text'} id={'user'} name={'user'} className={'max-w-[100px]'} />
            </Flex>
            <Flex className={'items-center justify-center gap-4'}>
              <Label htmlFor={'user'}> Usuario</Label>
              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a fruit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Fruits</SelectLabel>
                    <SelectItem value="apple">Apple</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="blueberry">Blueberry</SelectItem>
                    <SelectItem value="grapes">Grapes</SelectItem>
                    <SelectItem value="pineapple">Pineapple</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Flex>
          </Flex>
        </form>
      </Flex>
    </HeaderSection>
  );
};

export default HeaderPlayDetail;
