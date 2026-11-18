import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { IOrganizationEntityFront } from '@helper/types/organization.type';
import { buildUserSlipPDF } from '@/functions/printLiquidationCashier';
import { downloadFiles, shareFiles } from '@/functions/shareFiles';
import {
  quinielaLiquidationPdfName,
  quinielaLiquidationZipEntries,
  quinielaLiquidationZipName,
  zipFiles,
} from '@/lib/liquidationZip';
import { fetchCurrentAccountData, fetchWinningBetsForAccount } from './shared';

const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Exportar liquidación: un PDF por pasador, todos en un ZIP
 * `quiniela_liquidaciones_DD-MM-YYYY` con una carpeta por grupo. En el celular
 * se comparte; en la computadora (o si no se puede compartir), se descarga.
 */
export async function exportLiquidacion(
  queryClient: QueryClient,
  date: string | null,
  setPrinting: (v: boolean) => void,
  groups: IOrganizationEntityFront[] = []
) {
  try {
    setPrinting(true);
    const accounts = await fetchCurrentAccountData(queryClient, date);
    if (!accounts?.length) {
      toast.error('No hay cuentas a liquidar.');
      return;
    }

    // Un group_id que no es un grupo de la lista (la organización) va a "Sin grupo".
    const groupName = new Map(groups.map((group) => [group.organization_id, group.name]));
    const zipDate = date ?? accounts[0].date;
    const zipName = quinielaLiquidationZipName(zipDate);

    const sheets = accounts.map((account) => ({
      account,
      fileName: quinielaLiquidationPdfName(account.user_number, account.user_name, account.date),
      groupName: account.group_id ? groupName.get(account.group_id) : undefined,
      date: account.date,
    }));

    const files: { path: string; data: Uint8Array }[] = [];
    for (const { path, item } of quinielaLiquidationZipEntries(sheets, zipName)) {
      const bets = await fetchWinningBetsForAccount(queryClient, item.account);
      const { doc } = await buildUserSlipPDF({
        account: item.account,
        date: item.account.date,
        bets,
      });
      files.push({ path, data: new Uint8Array(doc.output('arraybuffer')) });
    }

    const blob = await zipFiles(files);
    const file = new File([blob], zipName, { type: 'application/zip' });
    if (isMobileDevice()) await shareFiles([file]);
    else downloadFiles([file]);
    toast.success('Liquidaciones exportadas.');
  } catch (e) {
    console.error(e);
    toast.error('Error exportando liquidaciones.');
  } finally {
    setPrinting(false);
  }
}
