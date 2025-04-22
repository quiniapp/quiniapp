import { Flex, FlexCol } from '@/components/flex';

import { TypographyMuted } from '@/components/ui/typography-muted';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from '@/components/ui/select';
import { MODALIDADES, QUINIELA_PROVINCIAS } from '@/constants/LIstCommonBets.ts';

const PlayAndHitsSelect = () => {
  return (
    <Flex className={' space-x-4'}>
      <Flex className={'flex-1 space-x-4'}>
        <FlexCol className={'flex-1 gap-3'}>
          <TypographyMuted label={'Pasador'} />
          <Select>
            <SelectTrigger className={'border w-full py-[24px]'}>
              <SelectValue placeholder={'Todos'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={'Todos'}> Todos</SelectItem>
              <SelectItem value={'Pasador 2'}> Pasador 2</SelectItem>
              <SelectItem value={'Pasador 3'}> Pasador 3</SelectItem>
            </SelectContent>
          </Select>
        </FlexCol>
        <FlexCol className={'flex-1 gap-3'}>
          <TypographyMuted label={'Grupo'} />
          <Select>
            <SelectTrigger className={'border w-full py-[24px]'}>
              <SelectValue placeholder={'Todos'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={'Todos'}> Todos</SelectItem>
              <SelectItem value={'Pasador 1'}> Grupo 1</SelectItem>
              <SelectItem value={'Pasador 2'}> Grupo 2</SelectItem>
              <SelectItem value={'Pasador 4'}> Grupo 4</SelectItem>
              <SelectItem value={'Pasador 5'}> Grupo 5</SelectItem>
            </SelectContent>
          </Select>
        </FlexCol>
      </Flex>
      <Flex className={'flex-1 space-x-4'}>
        <Flex className={'flex-1 gap-3'}>
          <FlexCol className={'flex-1 gap-3'}>
            <TypographyMuted label={'Turno'} />
            <Select>
              <SelectTrigger className={'border w-full py-[24px]'}>
                <SelectValue placeholder={'Todos'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={'Todos'}> Todos</SelectItem>
                {MODALIDADES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {' '}
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FlexCol>
        </Flex>
        <Flex className={'flex-1 gap-3'}>
          <FlexCol className={'flex-1 gap-3'}>
            <TypographyMuted label={'Quniela'} />
            <Select>
              <SelectTrigger className={'border w-full py-[24px]'}>
                <SelectValue placeholder={'Todos'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={'Todos'}> Todos</SelectItem>
                {QUINIELA_PROVINCIAS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {' '}
                    {item.label}
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
