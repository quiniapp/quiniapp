import { SearchIcon } from 'lucide-react';

import Box from '@/components/box';
import { Fieldset } from '@/components/fieldset';
import { Flex, FlexCol } from '@/components/flex';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { TypographyMuted } from '@/components/ui/typography-muted.tsx';
import { SelectDayToSearch } from '@/features/plays-and-hits/select-day-to-search.tsx';

const FormHeaderFilter = () => {
  return (
    <form>
      <Flex className={' space-y-4'}>
        <FlexCol className={'  mb-4 1440:gap-6  gap-2 '}>
          <Fieldset legend={'Pasador:'} className={'w-full gap-3'}>
            <FlexCol className={'space-y-4'}>
              <Flex className={' gap-3'}>
                <Select>
                  <SelectTrigger className={'border w-full '}>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    <SelectItem value="pasador">pasador</SelectItem>
                  </SelectContent>
                </Select>
              </Flex>
              <Flex className={'flex-1 gap-2 '}>
                <Flex className={'items-center gap-3'}>
                  <Box>
                    <TypographyMuted label={'Fecha'} />
                  </Box>
                  <Box className={'w-[200px] overflow-hidden'}>
                    <SelectDayToSearch onDayChange={() => {}} className={'!w-[200px]'} />
                  </Box>
                </Flex>
                <Flex className={'w-[150px]'}>
                  <Flex className={'w-full items-center gap-3'}>
                    <Box>
                      <TypographyMuted label={'Tickets'} />
                    </Box>
                    <Select>
                      <SelectTrigger className={'border w-full '}>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todos">Todos</SelectItem>
                        <SelectItem value="pasador">pasador</SelectItem>
                      </SelectContent>
                    </Select>
                  </Flex>
                </Flex>
              </Flex>
            </FlexCol>
          </Fieldset>

          <Fieldset legend={'Buscar por número de Ticket:'} className={'w-full gap-3'}>
            <Flex className={'gap-4'}>
              <Input type={'number'} placeholder={''} />
              <Flex className={'gap-4'}>
                <Button type={'button'} className={'!px-6'}>
                  <SearchIcon /> Buscar
                </Button>
                <Button type={'reset'} variant={'outline'} className={'!px-6'}>
                  Limpiar
                </Button>
              </Flex>
            </Flex>
          </Fieldset>
        </FlexCol>
      </Flex>
    </form>
  );
};

export default FormHeaderFilter;
