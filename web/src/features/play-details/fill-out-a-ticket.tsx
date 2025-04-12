import Flex from '@/components/flex';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Button } from '@/components/ui/button.tsx';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox.tsx';

const FillOutATicket = () => {
  return (
    <Flex className={'flex-col xl:flex-row py-[36px] gap-[56px]'}>
      <Flex className={'flex-1 max-w-[350px]'}>
        <form className={'w-full'}>
          <Flex className={'flex-col space-y-4 '}>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'number'}> Numero </Label>
              <Input id="number" name={'ticket-number'} type={'number'} placeholder={'000'} />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'amount'}> Monto </Label>
              <Input id="amount" name={'ticket-amount'} type={'number'} placeholder={'000'} />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'place'}> Ubicacion </Label>
              <Input id="place" name={'ticket-place'} type={'number'} placeholder={'000'} />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'with'}> Con </Label>
              <Input id="with" name={'ticket-with'} type={'number'} placeholder={'000'} />
            </Flex>
            <Flex className={'flex-col space-y-3 '}>
              <Label htmlFor={'position'}> Posición </Label>
              <Input id="position" name={'ticket-position'} type={'number'} placeholder={'000'} />
            </Flex>
          </Flex>
          <Flex className={' gap-4 py-[24px]'}>
            <Button type={'button'} className={'flex-1'}>
              {' '}
              <PlusIcon /> Agregar{' '}
            </Button>
            <Button type={'reset'} className={'flex-1 max-w-[120px]'} variant={'outline'}>
              {' '}
              <TrashIcon /> Borrar{' '}
            </Button>
          </Flex>
        </form>
      </Flex>
      <Flex className={'flex-col space-y-4 flex-1'}>
        <Flex className={'flex-col border-2 p-4 '}>
          <p className={'text-lg'}> Turnos </p>
          <Flex className={'pt-8 space-x-4'}>
            <Flex className={'gap-2'}>
              <Label htmlFor={'f1'}> La Previa </Label>
              <Checkbox id={'f1'} name={'f1'} className={'border-2'} />
            </Flex>

            <Flex className={'gap-2'}>
              <Label htmlFor={'primera'}> Primera </Label>
              <Checkbox id={'primera'} name={'primera'} className={'border-2'} />
            </Flex>

            <Flex className={'gap-2'}>
              <Label htmlFor={'f2'}> Matutina </Label>
              <Checkbox id={'f2'} name={'f2'} className={'border-2'} />
            </Flex>

            <Flex className={'gap-2'}>
              <Label htmlFor={'f3'}> Vespertina </Label>
              <Checkbox id={'f3'} name={'f3'} className={'border-2'} />
            </Flex>

            <Flex className={'gap-2'}>
              <Label htmlFor={'f4'}> Nocturna </Label>
              <Checkbox id={'f4'} name={'f4'} className={'border-2'} />
            </Flex>
          </Flex>
        </Flex>
        <Flex className={'flex-col border-2 p-4'}>
          <p className={'text-lg'}>Quinielas </p>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default FillOutATicket;
