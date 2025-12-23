import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BACKEND_ROUTES } from '../../../../routes/routes.ts';
import { INewResultsEntity  } from '@helper/request/results.request.ts';


const performCreateResults = async (

  createResults: INewResultsEntity
): Promise<void> => {
  const res = await fetch(BACKEND_ROUTES.results.base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ newResults:createResults }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error updating results: ${errorText}`);
  }

  return;
};

export const useCreateResults = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({  createResults }: {  createResults: INewResultsEntity }) =>
      performCreateResults(createResults),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
    
  });
};
