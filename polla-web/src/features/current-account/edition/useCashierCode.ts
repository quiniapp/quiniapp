import { useMemo } from 'react';
import { pollaCashierCode } from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useGroups } from '@/hooks/fetchs/useCatalogs';

/** Grupos de la organización y el `{grupo}-{número}` de un pasador (el número se repite entre grupos). */
export const useCashierCode = () => {
  const { organizationId } = useAuth();
  const { data } = useGroups({ polla_organization_id: organizationId ?? undefined });
  const groups = useMemo(() => data?.data ?? [], [data]);
  const groupById = useMemo(
    () => new Map(groups.map((group) => [group.polla_group_id, group])),
    [groups]
  );

  const cashierCode = (row: { polla_group_id: string | null; user_number: number | null }) =>
    pollaCashierCode(
      row.polla_group_id ? groupById.get(row.polla_group_id)?.number : undefined,
      row.user_number
    );

  return { groups, groupById, cashierCode };
};
