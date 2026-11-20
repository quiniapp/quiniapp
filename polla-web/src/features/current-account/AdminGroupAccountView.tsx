import { useRef, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { IPollaGroupEditionLiquidation, pollaEditionTitle } from '@helper/polla/types/game.type';
import { useAuth } from '@/providers/AuthContext';
import { useDrawCatalogs, useGroups } from '@/hooks/fetchs/useCatalogs';
import { useMyGroupEditionLiquidations } from '@/hooks/fetchs/usePollaData';
import { EmptyState, ErrorState, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { downloadGroupLiquidationPDF } from '@/functions/current-account/groupLiquidationPDF';
import { renderLiquidationImage } from '@/functions/current-account/liquidationImage';
import { downloadFiles, shareFiles } from '@/functions/shareFiles';
import { isMobileDevice } from '@/functions/printPdf';
import { groupSplit } from '@/lib/editionAccount';
import { groupLiquidationImageLines } from '@/lib/liquidationImageLines';
import { groupLiquidationFileName } from '@/lib/liquidationZip';
import {
  type GroupLiquidationSheet,
  groupLiquidationLabel,
  groupOwed,
  groupPaymentStatus,
} from '@/lib/groupLiquidation';
import { AccountTabs } from './dialogs/shared';
import { fetchOrganizationName } from './fetchers';
import { fmtMoney, fmtOwed } from './format';
import { GroupAccountHistory } from './GroupAccounts';
import { useOrganizationName } from './useOrganizationName';

type AdminTab = 'edition' | 'history';

const ADMIN_TABS: { value: AdminTab; label: string }[] = [
  { value: 'edition', label: 'Por edición' },
  { value: 'history', label: 'Historial por fechas' },
];

const fmtDate = (value: string) => dayjs(value).format('DD/MM/YYYY');

type Format = 'pdf' | 'png';

/**
 * Los renglones de la página, formateados igual que la tabla de liquidaciones
 * del dueño (con decimales y gastos en positivo). El PDF y la imagen usan
 * pesos enteros (`groupLiquidationRows`). Cobros, Pagos, Debe y Estado son
 * solo para mirar: los carga el dueño al liquidar. Las etiquetas son fijas
 * (son las columnas): un Debe negativo dice "Cobra $X" en el valor.
 */
const pageRows = (account: IPollaGroupEditionLiquidation['account']) => {
  const split = groupSplit(account.base, account.admin_commission);
  return [
    { label: 'Deja pasadores', value: `$${fmtMoney(account.cashiers_subtotal)}` },
    { label: 'Gastos', value: `$${fmtMoney(account.expenses)}` },
    { label: 'Total', value: `$${fmtMoney(account.base)}` },
    { label: '% admin', value: `${Number(account.admin_percentage)}%` },
    { label: 'Total admin', value: `$${fmtMoney(split.admin)}` },
    { label: 'Total capitalista', value: `$${fmtMoney(split.capitalist)}` },
    { label: 'Cobros', value: `$${fmtMoney(account.collections)}` },
    { label: 'Pagos', value: `$${fmtMoney(account.payments)}` },
    { label: 'Debe', value: fmtOwed(groupOwed(account)) },
    { label: 'Estado', value: groupPaymentStatus(account) ?? '—' },
  ];
};

/**
 * Las liquidaciones por edición del grupo del admin, solo para consultar, con
 * la misma información que ve el dueño (capitalista incluido) y los botones
 * para bajar la hoja en PDF o en imagen.
 */
const AdminEditionLiquidations = () => {
  const { user, organizationId } = useAuth();
  const catalogs = useDrawCatalogs(organizationId);
  const { data: groups } = useGroups();
  const { data, isFetching, isError, refetch } = useMyGroupEditionLiquidations();
  // Filas que se están generando (por id): evita el doble toque, fila por fila.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  // Imagen ya generada que el navegador no dejó compartir ("Tocá de nuevo"): el
  // próximo toque la comparte al instante, sin regenerar (Safari exige poco
  // tiempo entre el toque y el share). Clave: id + edited_at.
  const pendingImages = useRef(new Map<string, File>());
  // El nombre de la organización se trae antes del toque, no dentro del handler.
  const { data: orgName } = useOrganizationName(organizationId);
  const setRowBusy = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const groupNumber = groups?.data.find(
    (group) => group.polla_group_id === user?.polla_group_id
  )?.number;

  const titleOf = (item: IPollaGroupEditionLiquidation) =>
    pollaEditionTitle(item.edition, catalogs);

  const download = async (item: IPollaGroupEditionLiquidation, format: Format) => {
    // Para distinguir "no se pudo generar" de "no se pudo compartir" en la imagen.
    let sharing = false;
    const id = item.account.polla_group_edition_account_id;
    const pendingKey = `${id}:${item.account.edited_at}`;
    setRowBusy(id, true);
    try {
      const pending = format === 'png' ? pendingImages.current.get(pendingKey) : undefined;
      if (pending) {
        sharing = true;
        if ((await shareFiles([pending])) === 'blocked') toast('Tocá de nuevo para compartir');
        else pendingImages.current.delete(pendingKey);
        return;
      }

      const sheet: GroupLiquidationSheet = {
        account: item.account,
        group: { number: groupNumber, name: item.account.group_name },
        orgName: orgName || (await fetchOrganizationName(organizationId)),
        editionTitle: titleOf(item),
        date: dayjs(item.account.edited_at).format('YYYY-MM-DD'),
      };

      if (format === 'pdf') {
        await downloadGroupLiquidationPDF(sheet);
        return;
      }

      const blob = await renderLiquidationImage(groupLiquidationImageLines(sheet));
      const file = new File([blob], groupLiquidationFileName(sheet.group, sheet.date, 'png'), {
        type: 'image/png',
      });
      if (!isMobileDevice()) {
        downloadFiles([file]);
        return;
      }
      sharing = true;
      if ((await shareFiles([file])) === 'blocked') {
        pendingImages.current.set(pendingKey, file);
        toast('Tocá de nuevo para compartir');
      }
    } catch (error) {
      console.error(error);
      toast.error(
        format === 'pdf'
          ? 'No se pudo descargar la liquidación'
          : sharing
            ? 'No se pudo compartir la imagen'
            : 'No se pudo generar la imagen'
      );
    } finally {
      setRowBusy(id, false);
    }
  };

  if (isError && !data) return <ErrorState onRetry={() => void refetch()} />;
  if (!data) return <EmptyState message={isFetching ? 'Cargando…' : 'No se pudo cargar.'} />;
  if (data.length === 0) return <EmptyState message="Todavía no hay liquidaciones de tu grupo" />;

  const actions = (item: IPollaGroupEditionLiquidation) => {
    const id = item.account.polla_group_edition_account_id;
    const label = `${groupLiquidationLabel({ number: groupNumber, name: item.account.group_name })}, ${titleOf(item)}`;
    return (
      <div className="flex gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title="Descargar PDF"
          disabled={busy.has(id)}
          aria-label={`Descargar el PDF de ${label}`}
          onClick={() => void download(item, 'pdf')}
        >
          <FileText />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title="Bajar imagen"
          disabled={busy.has(id)}
          aria-label={`Bajar la imagen de ${label}`}
          onClick={() => void download(item, 'png')}
        >
          <ImageIcon />
        </Button>
      </div>
    );
  };

  const labels = pageRows(data[0].account).map((row) => row.label);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border bg-card text-card-foreground md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Edición</TableHead>
              <TableHead>Liquidada</TableHead>
              {labels.map((label) => (
                <TableHead key={label} className="text-right">
                  {label}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.account.polla_group_edition_account_id}>
                {/* El título largo baja de renglón: con Cobros, Pagos, Debe y Estado no entra a 1400 px. */}
                <TableCell className="min-w-[180px] whitespace-normal font-medium">
                  {titleOf(item)} · {fmtDate(item.edition.start_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {fmtDate(item.account.edited_at)}
                </TableCell>
                {pageRows(item.account).map((row) => (
                  <TableCell key={row.label} className="text-right tabular-nums">
                    {row.value}
                  </TableCell>
                ))}
                <TableCell>{actions(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {data.map((item) => (
          <li
            key={item.account.polla_group_edition_account_id}
            className="flex flex-col gap-2 rounded-md border bg-card p-3 text-card-foreground"
          >
            <div className="flex flex-col">
              <span className="font-medium">{titleOf(item)}</span>
              <span className="text-xs text-muted-foreground">
                {fmtDate(item.edition.start_date)} · Liquidada el {fmtDate(item.account.edited_at)}
              </span>
            </div>
            <dl className="flex flex-col gap-1 text-sm">
              {pageRows(item.account).map((row) => (
                <div key={row.label} className="flex justify-between gap-2 border-b pb-1">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
            {actions(item)}
          </li>
        ))}
      </ul>
    </>
  );
};

/** La cuenta corriente del admin: las liquidaciones de su grupo, solo lectura. */
export const AdminGroupAccountView = () => {
  const [tab, setTab] = useState<AdminTab>('edition');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader description="Las liquidaciones de tu grupo, solo para consultar." />
      <AccountTabs tabs={ADMIN_TABS} value={tab} onChange={setTab} />
      {tab === 'edition' ? <AdminEditionLiquidations /> : <GroupAccountHistory mine />}
    </div>
  );
};
