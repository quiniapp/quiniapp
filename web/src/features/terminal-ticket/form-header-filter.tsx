import { Flex, FlexCol } from '@/components/flex';
import Box from '@/components/box';
import { TypographyMuted } from '@/components/ui/typography-muted.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button';
import { SearchIcon } from 'lucide-react';
import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';

const FormHeaderFilter = () => {
  return (
    <form>
      <FlexCol className={' space-y-4'}>
        <FlexCol className={'bg-bg-card border p-4 mb-4  space-y-6 '}>
          <Box className={'space-x-6 grid grid-cols-[repeat(3,1fr)]'}>
            <Flex className={'flex-1'}>
              <FlexCol className={'w-full gap-3'}>
                <TypographyMuted label={'Pasador'} />
                <Select>
                  <SelectTrigger className={'border w-full py-[24px]'}>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    <SelectItem value="pasador">pasador</SelectItem>
                  </SelectContent>
                </Select>
              </FlexCol>
            </Flex>

            <Flex className={'flex-1'}>
              <FlexCol className={'w-full gap-3'}>
                <TypographyMuted label={'Fecha'} />
                <SelectDayToSearch />
              </FlexCol>
            </Flex>
            <Flex className={'flex-1'}>
              <FlexCol className={'w-full gap-3'}>
                <TypographyMuted label={'Tickets'} />
                <Select>
                  <SelectTrigger className={'border w-full py-[24px]'}>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    <SelectItem value="pasador">pasador</SelectItem>
                  </SelectContent>
                </Select>
              </FlexCol>
            </Flex>
          </Box>

          <Box className={' space-x-6 grid grid-cols-[repeat(3,1fr)]'}>
            <FlexCol className={'w-full gap-3'}>
              <TypographyMuted label={'Buscar por numero de Ticket:'} />
              <Input type={'number'} placeholder={''} className={'h-[48px]'} />
            </FlexCol>
            <FlexCol className={'w-full gap-3 pt-[30px]'}>
              <Flex className={'gap-4'}>
                <Button type={'button'} className={'!px-6'}>
                  <SearchIcon /> Buscar
                </Button>
                <Button type={'reset'} variant={'outline'} className={'!px-6'}>
                  Limpiar
                </Button>
              </Flex>
            </FlexCol>
          </Box>
        </FlexCol>
      </FlexCol>
    </form>
  );
};

export default FormHeaderFilter;
