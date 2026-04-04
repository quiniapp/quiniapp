import { useEffect } from 'react';
import Box from '@/components/box';
import FilterSection from '@/components/filter-section';
import CurrentAccountTable from '@/features/current-account/current-account-table';
import { useGetCurrentAccount } from '@/hooks/fetchs/current-account/useGetCurrentAccount';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

const SettlementPayrollTable = () => {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  const group_id = searchParams.get('group_id');
  const user_id = searchParams.get('user_id');
  const { data: rawData, isLoading, isPending, isError } = useGetCurrentAccount(date, group_id);
  const data = user_id ? rawData?.filter((acc) => acc.user_id === user_id) : rawData;

  useEffect(() => {
    if (isError) {
      toast.error('Error al obtener los datos');
    }
  }, [isError]);

  return (
    <Box className="overflow-auto bg-[var(--primary-bg-content)] py-[24px] text-white">
      <FilterSection />
      <>
        Fecha de la Liquidación : {data?.[0]?.date && dayjs(data?.[0]?.date).format('DD/MM/YYYY')}
      </>
      <CurrentAccountTable
        data={data ?? []}
        // totals={}
        isLoading={isLoading}
        isPending={isPending}
      />
    </Box>
  );
};

export default SettlementPayrollTable;
