import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isCurrentAccountQuery } from './refresh';

/** Recarga las consultas de la cuenta corriente que están en pantalla. */
export const RefreshAccountButton = () => {
  const queryClient = useQueryClient();
  const isRefreshing = useIsFetching({ predicate: (q) => isCurrentAccountQuery(q.queryKey) }) > 0;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isRefreshing}
      onClick={() =>
        void queryClient.invalidateQueries({
          predicate: (q) => isCurrentAccountQuery(q.queryKey),
        })
      }
    >
      <RefreshCw className={isRefreshing ? 'animate-spin' : undefined} />
      Actualizar
    </Button>
  );
};
