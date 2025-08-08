import { useSessionStore } from '@/stores/sessionStore';
import { USER_TYPE } from '../../../../helper/types/user.type';
import { useSearchParams } from 'react-router-dom';

const SelectBetType = () => {
  const { role } = useSessionStore();
  if (role === USER_TYPE.CASHIER) return null;
    const [searchParams, setSearchParams] = useSearchParams()

  return <div>Se</div>;
};

export default SelectBetType;
