
import { USER_TYPE } from '@helper/types/user.type';
import { useSearchParams } from 'react-router-dom';
import { Flex } from '@/components/flex';
import { CheckboxWithLabel } from '@/components/button/CheckboxWithLabel';
import { betTypeParse } from '@helper/functions/betTypeParse';
import { BET_TYPE } from '@helper/types/bet.type';
import { useAuth } from '@/contexts/AuthContext';

const SelectBetType = () => {
  const { role } = useAuth();
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
      <CheckboxWithLabel
        id={BET_TYPE.QUATERN}
        label={betTypeParse[BET_TYPE.QUATERN]}
        checked={quaternOn}
        onCheckedChange={(v) => setFlag('quatern', !!v)}
        labelClassName="text-[12px] min-w-[90px]"
      />

      <CheckboxWithLabel
        id={BET_TYPE.TERN}
        label={betTypeParse[BET_TYPE.TERN]}
        checked={ternOn}
        onCheckedChange={(v) => setFlag('tern', !!v)}
        labelClassName="text-[12px] min-w-[90px]"
      />
    </Flex>
  );
};

export default SelectBetType;
