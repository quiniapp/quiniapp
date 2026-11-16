import { useState } from 'react';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { CashierAccountView } from './CashierAccountView';
import { AccountTabs } from './dialogs/shared';
import { EditionAccountsView } from './edition/EditionAccountsView';
import { GroupEditionAccounts } from './edition/GroupEditionAccounts';
import { DailyHistoryView } from './history/DailyHistoryView';

type AccountTab = 'cashiers' | 'groups' | 'history';

const ACCOUNT_TABS: { value: AccountTab; label: string }[] = [
  { value: 'cashiers', label: 'Pasadores' },
  { value: 'groups', label: 'Grupos' },
  { value: 'history', label: 'Historial por fechas' },
];

/**
 * Superadmin+ liquida por edición: a cada pasador y, con los de un grupo
 * liquidados, al grupo (comisión del admin). "Historial por fechas" es lo
 * liquidado por días, solo para consultar. El pasador ve lo suyo. El admin no
 * entra (lo frena la ruta).
 */
export const CurrentAccountPage = () => {
  const { role } = useAuth();
  const [tab, setTab] = useState<AccountTab>('cashiers');

  if (role === POLLA_USER_TYPE.CASHIER) return <CashierAccountView />;

  return (
    <div className="flex flex-col gap-4">
      <AccountTabs tabs={ACCOUNT_TABS} value={tab} onChange={setTab} />
      {tab === 'cashiers' && <EditionAccountsView />}
      {tab === 'groups' && <GroupEditionAccounts />}
      {tab === 'history' && <DailyHistoryView />}
    </div>
  );
};

export default CurrentAccountPage;
