import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import SkeletonList from '../skeletons/skeleton-list';
import { Flex, FlexCol } from '../flex';
import { Typography } from '../typography';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { IconButton } from '../button/IconButton';
import Modal from './custom-modal';
import { useSearchParams } from 'react-router-dom';
import { useGetCurrentAccount } from '@/hooks/fetchs/current-account/useGetCurrentAccount';
import { useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { useBulkUpdateCurrentAccount } from '@/hooks/mutations/current-account/useBulkUpdateCurrentAccount';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface GenerateLiquitationModalProps {
  isOpen: boolean;
  onClose: VoidFunction;
}
interface HandleChangeProps {
  key: string;
  id: string;
  value: number;
}
export interface editPayloadObject {
  claims?: number;
  paid?: number;
  collections?: number;
}

const GenerateLiquitationModal = ({ isOpen, onClose }: GenerateLiquitationModalProps) => {
  if (!isOpen) return null;
  const [calcLeave, setCalcLeave] = useState<boolean>(false);
  const [editPayload, setEditPayload] = useState<Map<string, editPayloadObject>>(new Map());
  const [searchParams] = useSearchParams();
  const { data, isLoading, isPending } = useGetCurrentAccount(searchParams.get('date'));
  const { mutate } = useBulkUpdateCurrentAccount();
  const handleChange = ({ key, value, id }: HandleChangeProps) => {
    setEditPayload((prev) => {
      const newMap = new Map(prev);
      const existingValue = newMap.get(id);
      newMap.set(id, { ...existingValue, [key]: value });
      return newMap;
    });
  };

  const handleGenerate = async () => {
    mutate(
      {
        updateCurrentAccount: editPayload, // Map<string, editPayloadObject>
        date: data?.[0].date ?? '',
        leave: calcLeave,
      },
      {
        onSuccess: () => {
          toast.success('Calculado correctamente');
          onClose();
        },
      }
    );
  };

  const totals = useMemo(() => {
    return data?.reduce(
      (currAcc, item) => {
        currAcc.pass += item.pass || 0;
        currAcc.successes += item.successes || 0;
        currAcc.claims += item.claims || 0;
        currAcc.subtotal += item.subtotal || 0;
        currAcc.previous_balance += item.previous_balance || 0;
        currAcc.collections += item.collections || 0;
        currAcc.paid += item.paid || 0;
        currAcc.total += item.total || 0;
        currAcc.drag += item.drag || 0;
        currAcc.leave += item.leave || 0;
        return currAcc;
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
  }, [data]);

  return (
    <Modal
      title={`Generar liquidaciones del día ${dayjs(data?.[0].date).format('DD-MM-YYYY')}`}
      isOpen={isOpen}
      onClose={onClose}
      className="flex flex-col items-center !max-w-[95vw] sm:!max-w-[90vw] md:!max-w-[980px] w-full m-auto bg-[#060813] pt-4 sm:pt-6 md:pt-[36px]"
    >
      <Flex
        className="gap-1 sm:gap-3"
        onClick={() => {
          setCalcLeave((prev) => !prev);
        }}
      >
        <Checkbox checked={calcLeave} />

        <Label>Liquidar todos los dejes</Label>
      </Flex>
      <FlexCol className="p-1 sm:p-3 gap-1 sm:gap-3 items-center w-full">
        <div className="overflow-x-auto w-full">
        <Table className="overflow-hidden rounded-sm min-w-[800px]">
          <TableHeader className="border overflow-hidden rounded-sm">
            <TableRow>
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
                  <TableCell>{account.user_number}</TableCell>
                  <TableCell>{account.user_name}</TableCell>
                  <TableCell>{Math.floor(account.pass)}</TableCell>
                  <TableCell>{Math.floor(account.successes)}</TableCell>
                  <TableCell>
                    <Input
                      className="text-white"
                      type="number"
                      onChange={(e) => {
                        handleChange({
                          id: account.current_account_id,
                          value: +e.target.value,
                          key: 'claims',
                        });
                      }}
                      defaultValue={Math.floor(account.claims)}
                    />
                  </TableCell>
                  <TableCell>{Math.floor(account.subtotal)}</TableCell>
                  <TableCell>{Math.floor(account.previous_balance)}</TableCell>
                  <TableCell>
                    <Input
                      className="text-white"
                      type="number"
                      onChange={(e) => {
                        handleChange({
                          id: account.current_account_id,
                          value: +e.target.value,
                          key: 'collections',
                        });
                      }}
                      defaultValue={Math.floor(account.collections)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="text-white"
                      type="number"
                      onChange={(e) => {
                        handleChange({
                          id: account.current_account_id,
                          value: +e.target.value,
                          key: 'paid',
                        });
                      }}
                      defaultValue={Math.floor(account.paid)}
                    />
                  </TableCell>
                  <TableCell>{Math.floor(account.total)}</TableCell>
                  <TableCell>{Math.floor(account.drag)}</TableCell>
                  <TableCell>{Math.floor(account.leave)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>

          <TableFooter className="border">
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell></TableCell>
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
        </div>
        <Flex className="gap-2 sm:gap-3 flex-col sm:flex-row w-full px-2 sm:px-4">
          <IconButton
            label="Generar liquidaciones"
            variant="default"
            onClick={() => handleGenerate()}
            className="w-full uppercase"
          />
          <IconButton
            label="Cancelar"
            variant="destructive"
            onClick={() => onClose()}
            className="w-full"
          />
        </Flex>
      </FlexCol>
    </Modal>
  );
};

export default GenerateLiquitationModal;
