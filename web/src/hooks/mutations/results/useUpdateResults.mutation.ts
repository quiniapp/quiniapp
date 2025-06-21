import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '../../../../routes/routes.ts';
import { IUpdateResultsEntity } from '../../../../helper/request/results.response.ts';


const performUpdateResults = async (
  id: string,
  updateResults: IUpdateResultsEntity
): Promise<void> => {
  const res = await fetch(ROUTES.results.id(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ updateResults }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error updating results: ${errorText}`);
  }

  return;
};

export const useUpdateResults = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updateResults }: { id: string; updateResults: IUpdateResultsEntity }) =>
      performUpdateResults(id, updateResults),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
};
