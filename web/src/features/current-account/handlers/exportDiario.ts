import { QueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { downloadCurrentAccountTablePDF } from '@/functions/exportDiarioPDF';
import { fetchCurrentAccountData } from './shared';

export async function exportDiario(
  queryClient: QueryClient,
  date: string | null,
  setPrinting: (v: boolean) => void
) {
  try {
    setPrinting(true);
    const rows = await fetchCurrentAccountData(queryClient, date);
    if (!rows?.length) {
      toast.error('No hay datos para exportar.');
      return;
    }
    await downloadCurrentAccountTablePDF({
      data: rows,
      date: rows[0]?.date ?? dayjs().format('YYYY-MM-DD'),
    });
  } catch (e) {
    console.error(e);
    toast.error('No se pudo generar el PDF.');
  } finally {
    setPrinting(false);
  }
}
