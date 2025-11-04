import Box from '@/components/box';
import { FlexCol } from '@/components/flex';
import { Typography } from '@/components/typography';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SkeletonList from '@/components/skeletons/skeleton-list';
import { Button } from '@/components/ui/button';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import React, { Suspense, useMemo, useState } from 'react';

interface CurrentAccountTableProps {
  data: ICurrentAccountEntityFront[];
  isLoading: boolean;
  isPending: boolean;
}

const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

const PAGE_SIZE = 30; // ⬅️ fácil de ajustar

const CurrentAccountTable = ({ data = [], isLoading, isPending }: CurrentAccountTableProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<ICurrentAccountEntityFront | undefined>();
  const [page, setPage] = useState(1);

  const handleClick = (ca: ICurrentAccountEntityFront) => {
    setIsOpen(true);
    setCurrentAccount(ca);
  };

  const totals = useMemo(() => {
    return data?.reduce(
      (acc, it) => ({
        pass: acc.pass + (it.pass || 0),
        successes: acc.successes + (it.successes || 0),
        claims: acc.claims + (it.claims || 0),
        subtotal: acc.subtotal + (it.subtotal || 0),
        previous_balance: acc.previous_balance + (it.previous_balance || 0),
        collections: acc.collections + (it.collections || 0),
        paid: acc.paid + (it.paid || 0),
        total: acc.total + (it.total || 0),
        drag: acc.drag + (it.drag || 0),
        leave: acc.leave + (it.leave || 0),
      }),
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
  }, [data]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return data.slice(start, start + PAGE_SIZE);
  }, [data, page]);

  const totalPages = Math.max(1, Math.ceil((data?.length || 0) / PAGE_SIZE));

  return (
    <Box className="p-2 sm:p-3">
      {/* --------- MOBILE CARDS (≤640) --------- */}
      <div className="sm:hidden space-y-2">
        {isLoading || isPending ? (
          <SkeletonList />
        ) : data.length === 0 ? (
          <div className="text-center py-8 rounded-md border border-dashed">
            <Typography variant="large">No se encontraron Datos</Typography>
            <Typography variant="small" className="font-light text-muted-foreground">
              Por favor realice una nueva búsqueda
            </Typography>
          </div>
        ) : (
          paginated.map((account) => (
            <div
              key={account.current_account_id}
              className="rounded-xl border p-3 bg-background/30"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{account.user_name}</div>
                <div className="text-xs opacity-70">#{account.user_number}</div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="opacity-70">Pase</span>
                <span className="text-right">{currency.format(account.pass || 0)}</span>

                <span className="opacity-70">Aciertos</span>
                <span className="text-right">{currency.format(account.successes || 0)}</span>

                <span className="opacity-70">Reclamos</span>
                <span className="text-right">{currency.format(account.claims || 0)}</span>

                <span className="opacity-70">Subtotal</span>
                <span className="text-right">{currency.format(account.subtotal || 0)}</span>

                <span className="opacity-70">Saldo Ant.</span>
                <span className="text-right">{currency.format(account.previous_balance || 0)}</span>

                <span className="opacity-70">Cobros</span>
                <span className="text-right">{currency.format(account.collections || 0)}</span>

                <span className="opacity-70">Pagos</span>
                <span className="text-right">{currency.format(account.paid || 0)}</span>

                <span className="opacity-70">Arrastre</span>
                <span className="text-right">{currency.format(account.drag || 0)}</span>

                <span className="opacity-70">Deje</span>
                <span className="text-right">{currency.format(account.leave || 0)}</span>

                <span className="opacity-70">Total</span>
                <span className="text-right font-medium">
                  {currency.format(account.total || 0)}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => handleClick(account)}
              >
                Liquidar
              </Button>
            </div>
          ))
        )}

        {/* paginación mobile */}
        {data.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs opacity-70">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        )}

        {/* totales mobile */}
        {data.length > 0 && (
          <div className="rounded-xl border p-3 mt-2 bg-background/30">
            <div className="font-medium mb-1">Total General</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="opacity-70">Pase</span>
              <span className="text-right">{currency.format(totals.pass)}</span>

              <span className="opacity-70">Aciertos</span>
              <span className="text-right">{currency.format(totals.successes)}</span>

              <span className="opacity-70">Reclamos</span>
              <span className="text-right">{currency.format(totals.claims)}</span>

              <span className="opacity-70">Subtotal</span>
              <span className="text-right">{currency.format(totals.subtotal)}</span>

              <span className="opacity-70">Saldo Ant.</span>
              <span className="text-right">{currency.format(totals.previous_balance)}</span>

              <span className="opacity-70">Cobros</span>
              <span className="text-right">{currency.format(totals.collections)}</span>

              <span className="opacity-70">Pagos</span>
              <span className="text-right">{currency.format(totals.paid)}</span>

              <span className="opacity-70">Arrastre</span>
              <span className="text-right">{currency.format(totals.drag)}</span>

              <span className="opacity-70">Deje</span>
              <span className="text-right">{currency.format(totals.leave)}</span>

              <span className="opacity-70">Total</span>
              <span className="text-right font-medium">{currency.format(totals.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* --------- DESKTOP TABLE (≥640) --------- */}
      <div className="hidden sm:block">
        {/* contenedor con scroll horizontal y header sticky */}
        <div className="w-full overflow-x-auto rounded-2xl border">
          <Table className="overflow-hidden rounded-[16px_16px_0_0]">
            <TableHeader className="border sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <TableRow>
                <TableHead className="whitespace-nowrap">Liquidar</TableHead>
                <TableHead className="whitespace-nowrap">Número</TableHead>
                <TableHead className="whitespace-nowrap">Nombre</TableHead>
                <TableHead className="text-right whitespace-nowrap">Pase</TableHead>
                <TableHead className="text-right whitespace-nowrap">Aciertos</TableHead>
                <TableHead className="text-right whitespace-nowrap">Reclamos</TableHead>
                <TableHead className="text-right whitespace-nowrap">Subtotal</TableHead>
                <TableHead className="text-right whitespace-nowrap">Saldo Anterior</TableHead>
                <TableHead className="text-right whitespace-nowrap">Cobros</TableHead>
                <TableHead className="text-right whitespace-nowrap">Pagos</TableHead>
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Arrastre</TableHead>
                <TableHead className="text-right whitespace-nowrap">Deje</TableHead>
                <TableHead className="whitespace-nowrap">Grupo</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="border">
              {isLoading || isPending ? (
                <TableRow>
                  <TableCell colSpan={14}>
                    <SkeletonList />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center">
                    <FlexCol className="w-full items-center justify-center gap-3 py-8">
                      <Typography variant="large">No se encontraron Datos</Typography>
                      <Typography variant="small" className="font-light text-muted-foreground">
                        Por favor realice una nueva búsqueda
                      </Typography>
                    </FlexCol>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((account) => (
                  <TableRow key={account.current_account_id}>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleClick(account)}>
                        Liquidar
                      </Button>
                    </TableCell>
                    <TableCell>{account.user_number}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{account.user_name}</TableCell>

                    <TableCell className="text-right">
                      {currency.format(account.pass || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.successes || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.claims || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.subtotal || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.previous_balance || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.collections || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.paid || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {currency.format(account.total || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.drag || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency.format(account.leave || 0)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              )}
            </TableBody>

            <TableFooter className="border">
              <TableRow>
                <TableCell colSpan={3}>Total General</TableCell>
                <TableCell className="text-right">{currency.format(totals.pass)}</TableCell>
                <TableCell className="text-right">{currency.format(totals.successes)}</TableCell>
                <TableCell className="text-right">{currency.format(totals.claims)}</TableCell>
                <TableCell className="text-right">{currency.format(totals.subtotal)}</TableCell>
                <TableCell className="text-right">
                  {currency.format(totals.previous_balance)}
                </TableCell>
                <TableCell className="text-right">{currency.format(totals.collections)}</TableCell>
                <TableCell className="text-right">{currency.format(totals.paid)}</TableCell>
                <TableCell className="text-right font-medium">
                  {currency.format(totals.total)}
                </TableCell>
                <TableCell className="text-right">{currency.format(totals.drag)}</TableCell>
                <TableCell className="text-right">{currency.format(totals.leave)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* paginación desktop */}
        {data.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm opacity-70">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>

      <Suspense fallback={<div>Cargando...</div>}>
        <UserCurrentAccountModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          currentAccount={currentAccount}
        />
      </Suspense>
    </Box>
  );
};

export default CurrentAccountTable;

const UserCurrentAccountModal = React.lazy(
  () => import('../../../components/modals/UserCurrentAccountModal')
);

/*  <Box className="p-1 sm:p-3">
   <Table className="overflow-hidden rounded-[16px_16px_0_0]">
     <TableHeader className="border overflow-hidden rounded-[16px_16px_0_0]">
       <TableRow>
         <TableHead> Liquidar </TableHead>
         <TableHead> Numero </TableHead>
         <TableHead> Nombre </TableHead>
         <TableHead> Pase </TableHead>
         <TableHead> Aciertos </TableHead>
         <TableHead> Reclamos </TableHead>
         <TableHead> Subtotal </TableHead>
         <TableHead> Saldo Anterior </TableHead>
         <TableHead> Cobros </TableHead>
         <TableHead> Pagos </TableHead>
         <TableHead> Total </TableHead>
         <TableHead> Arrastre </TableHead>
         <TableHead> Deje </TableHead>
         <TableHead> Grupo </TableHead>
       </TableRow>
     </TableHeader>

     <TableBody className="border">
       {isLoading || isPending ? (
         <TableRow>
           <TableCell colSpan={14}>
             <SkeletonList />
           </TableCell>
         </TableRow>
       ) : data?.length === 0 ? (
         <TableRow>
           <TableCell colSpan={14} className="text-center">
             <FlexCol className="w-full items-center justify-center gap-3 py-8">
               <Typography variant="large">No se encontraron Datos</Typography>
               <Typography variant="small" className="font-light text-muted-foreground">
                 Por favor realice una nueva búsqueda
               </Typography>
             </FlexCol>
           </TableCell>
         </TableRow>
       ) : (
         data?.map((account: ICurrentAccountEntityFront) => (
           <TableRow key={account.current_account_id}>
             <TableCell>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => {
                   handleClick(account);
                 }}
               >
                 Liquidar
               </Button>
             </TableCell>
             <TableCell>{account.user_number}</TableCell>
             <TableCell>{account.user_name}</TableCell>
             <TableCell>{account.pass}</TableCell>
             <TableCell>{account.successes}</TableCell>
             <TableCell>{account.claims}</TableCell>
             <TableCell>{account.subtotal}</TableCell>
             <TableCell>{account.previous_balance}</TableCell>
             <TableCell>{account.collections}</TableCell>
             <TableCell>{account.paid}</TableCell>
             <TableCell>{account.total}</TableCell>
             <TableCell>{account.drag}</TableCell>
             <TableCell>{account.leave}</TableCell>
             <TableCell></TableCell>
           </TableRow>
         ))
       )}
     </TableBody>

     <TableFooter className="border">
       <TableRow>
         <TableCell colSpan={3}>Total General</TableCell>
         <TableCell>${totals?.pass}</TableCell>
         <TableCell>${totals?.successes}</TableCell>
         <TableCell>${totals?.claims}</TableCell>
         <TableCell>${totals?.subtotal.toFixed(2)}</TableCell>
         <TableCell>${totals?.previous_balance.toFixed(2)}</TableCell>
         <TableCell>${totals?.collections.toFixed(2)}</TableCell>
         <TableCell>${totals?.paid.toFixed(2)}</TableCell>
         <TableCell>${totals?.total.toFixed(2)}</TableCell>
         <TableCell>${totals?.drag.toFixed(2)}</TableCell>
         <TableCell>${totals?.leave.toFixed(2)}</TableCell>
       </TableRow>
     </TableFooter>
   </Table>
   <Suspense fallback={<div>Cargando...</div>}>
     <UserCurrentAccountModal isOpen={isOpen} onClose={() => setIsOpen(false)} currentAccount={currentAccount} />
   </Suspense>
 </Box> */
