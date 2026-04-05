import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { IDeleteResultsEntity } from '@helper/request/results.request.ts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const performDeleteResults = async ({
  results_id,
}: IDeleteResultsEntity): Promise<void> => {
  const res = await fetchWithAuth(BACKEND_ROUTES.results.id(results_id), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error deleting results: ${errorText}`);
  }
};

export const useDeleteResults = () => {
  const queryClient = useQueryClient();

return useMutation({
    mutationFn: (params: IDeleteResultsEntity) => performDeleteResults(params),
    onSuccess: async (_data, { lottery_id, schedule_id, date }) => {
      // misma forma y orden que en useQuery
      await queryClient.invalidateQueries({
        queryKey: ['results', lottery_id, schedule_id, date],
        exact: true,
      });
    },
  });
}
