import { useSessionStore } from '@/stores/sessionStore';
import { USER_TYPE } from '../../../../helper/types/user.type';
import { useSearchParams } from 'react-router-dom';
import { Flex } from '@/components/flex';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { betTypeParse } from '../../../../helper/functions/betTypeParse';
import { BET_TYPE } from '../../../../helper/types/bet.type';

const SelectBetType = () => {
  const { role } = useSessionStore();
  if (role === USER_TYPE.CASHIER) return null;
  const [searchParams, setSearchParams] = useSearchParams();

  const isOn = (key: string) => searchParams.get(key) === 'true';

  const setFlag = (key: string, val: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (val)
      next.set(key, 'true'); // activa => agrega ?key=true
    else next.delete(key); // desactiva => lo remueve (false por defecto)
    setSearchParams(next, { replace: true });
  };

  const quaternOn = isOn('quatern');
  const ternOn = isOn('tern');

  return (
    <Flex className="gap-1 sm:gap-3 items-center">
      <Button>
        <Search /> Buscar
      </Button>

      <Checkbox
        id={BET_TYPE.QUATERN}
        className="border-2 border-primary"
        checked={quaternOn}
        onCheckedChange={(v) => setFlag('quatern', !!v)} // shadcn usa onCheckedChange
      />
      <Label htmlFor={BET_TYPE.QUATERN} className="text-[12px] min-w-[90px]">
        {betTypeParse[BET_TYPE.QUATERN]}
      </Label>

      <Checkbox
        id={BET_TYPE.TERN}
        className="border-2 border-primary"
        checked={ternOn}
        onCheckedChange={(v) => setFlag('tern', !!v)}
      />
      <Label htmlFor={BET_TYPE.TERN} className="text-[12px] min-w-[90px]">
        {betTypeParse[BET_TYPE.TERN]}
      </Label>
    </Flex>
  );
};

export default SelectBetType;
