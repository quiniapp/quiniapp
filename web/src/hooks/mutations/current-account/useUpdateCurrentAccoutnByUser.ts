import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';
import { IUpdateCurrentAccountEntity } from '../../../../../helper/request/current_account.response.ts';

type UpdateVars = {
  date: string;
  current_account_id: string;
  updateCurrentAccount: IUpdateCurrentAccountEntity;
};

const updateCurrentAccountByUser = async ({
  date,
  current_account_id,
  updateCurrentAccount,
}: UpdateVars): Promise<void> => {
  if (!date || !current_account_id) {
    throw new Error('Faltan parámetros: "date" y "user_id" son requeridos.');
  }

  const url = `${ROUTES.current_account.id(current_account_id)}?date=${encodeURIComponent(date)}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ updateCurrentAccount }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error updating current-account: ${errorText}`);
  }
};

export const useUpdateCurrentAcoountByUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['updateCurrentAccountByUser'],
    mutationFn: updateCurrentAccountByUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getCurrentAccount'] });
    },
  });
};
