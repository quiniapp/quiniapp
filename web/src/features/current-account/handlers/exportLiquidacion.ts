import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
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
 * Las cuentas para elegir en "Exportar liquidación" (todas: las que no tienen
 * movimiento vienen sin tildar). `null` si no hay ninguna o falló la carga.
 */
export async function loadLiquidationAccounts(
  queryClient: QueryClient,
  date: string | null
): Promise<ICurrentAccountEntityFront[] | null> {
  try {
    const accounts = await fetchCurrentAccountData(queryClient, date);
    if (!accounts?.length) {
      toast.error('No hay cuentas a liquidar.');
      return null;
    }
    return accounts;
  } catch (e) {
    console.error(e);
    toast.error('Error cargando las cuentas.');
    return null;
  }
}

/**
 * Exportar liquidación: un PDF por cada pasador elegido, todos en un ZIP
 * `quiniela_liquidaciones_DD-MM-YYYY` con una carpeta por grupo. En el celular
 * se comparte; en la computadora, o si el navegador no deja compartir, se
 * descarga. True si se entregó (false si falló o se canceló el compartir).
 */
export async function exportLiquidacion(
  queryClient: QueryClient,
  accounts: ICurrentAccountEntityFront[],
  date: string | null,
  groups: IOrganizationEntityFront[] = []
): Promise<boolean> {
  try {
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
    if (isMobileDevice()) {
      const result = await shareFiles([file]);
      if (result === 'cancelled') return false;
      // Safari pide un toque nuevo si armar el ZIP tardó: se descarga, como en la Polla.
      if (result === 'blocked') downloadFiles([file]);
    } else downloadFiles([file]);
    toast.success('Liquidaciones exportadas.');
    return true;
  } catch (e) {
    console.error(e);
    toast.error('Error exportando liquidaciones.');
    return false;
  }
}
