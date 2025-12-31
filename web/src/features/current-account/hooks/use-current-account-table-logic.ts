import { useMemo } from 'react';
import { useCurrentAccounts } from '@/hooks/useCurrentAccount';
import type {
  Totals,
  FilterParams,
} from '@/types/current-account.type';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';

export function useCurrentAccountTableLogic(filters: FilterParams = {}) {
  const { data, isPending, isLoading } = useCurrentAccounts();

  const rawData: ICurrentAccountEntityFront[] = Array.isArray(data?.data?.mockCurrentAccounts)
    ? data.data.mockCurrentAccounts
    : [];

  const DATA = useMemo(() => {
    return rawData.filter((item) => {
      // Filter by date if provided (assuming item.date format matches filter)
      if (filters.date && item.date !== filters.date) return false;
      // Filter by group if provided (assuming item.group exists)
      //if (filters.group && filters.group !== 'Todos' && item.group !== filters.group) return false;
      // Filter by employee number substring
      if (filters.employeeNumber && !item.user_number.toString().includes(filters.employeeNumber)) {
        return false;
      }
      return true;
    });
  }, [rawData, filters.date, filters.group, filters.employeeNumber]);

  const totals: Totals = useMemo(() => {
    return DATA.reduce(
      (acc, item) => {
        acc.pass += item.pass ?? 0;
        acc.successes += item.successes ?? 0;
        acc.claims += item.claims ?? 0;
        acc.subtotal += item.subtotal ?? 0;
        acc.previous_balance += item.previous_balance ?? 0;
        acc.collections += item.collections ?? 0;
        acc.paid += item.paid ?? 0;
        acc.total += item.total ?? 0;
        acc.drag += item.drag ?? 0;
        acc.leave += item.leave ?? 0;
        return acc;
      },
      {
        pass: 0,
        successes: 0,
        claims: 0,
        subtotal: 0,
        previous_balance: 0,
        collections: 0,
        paid: 0,
        total: 0,
        drag: 0,
        leave: 0,
      }
    );
  }, [DATA]);

  return {
    DATA,
    totals,
    isLoading,
    isPending,
  };
}
