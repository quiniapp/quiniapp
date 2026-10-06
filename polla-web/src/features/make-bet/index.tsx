import { useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Repeat2 } from 'lucide-react';
import { IPollaEditionEntityFront, POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';
import {
  IPollaUserByNumber,
  POLLA_USER_TYPE,
  isPollaAdminRole,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditions } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { useCreateBet } from '@/hooks/mutations/usePollaMutations';
import { PollaNumberBoxes, PollaNumberBoxesHandle } from '@/components/PollaNumberBoxes';
import { createEmptyPollaNumbers, pollaNumbersError } from '@/lib/pollaNumbers';
import { EmptyState } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { makePollaTicketPdf } from '@/functions/makePollaTicket';
import { deliverPdf } from '@/functions/printPdf';
import { RepeatBetDialog } from './RepeatBetDialog';
import { TargetUserByNumber } from './TargetUserByNumber';

const fmtDate = (value: string) => dayjs(value).format('DD-MM-YYYY');
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));

export const MakeBetPage = () => {
  const { role, organizationId } = useAuth();
  const today = dayjs().format('YYYY-MM-DD');

  const canManage = Boolean(role && isPollaAdminRole(role));
  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  const isPlayer = role === POLLA_USER_TYPE.PLAYER;
  // ADMIN+ no juega a su nombre: siempre carga para un pasador o un jugador.
  // El pasador carga a su nombre o al de uno de sus jugadores.
  const pickTarget = canManage || isCashier;

  const [editionId, setEditionId] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [target, setTarget] = useState<IPollaUserByNumber | null>(null);
  const [numbers, setNumbers] = useState<string[]>(createEmptyPollaNumbers());
  const [repeatOpen, setRepeatOpen] = useState(false);
  const boxesRef = useRef<PollaNumberBoxesHandle>(null);

  const { data: editions } = useEditions({
    status: POLLA_EDITION_STATUS.ACTIVE,
    loadable_on: today,
    polla_organization_id: organizationId ?? undefined,
  });
  const { data: lotteries } = useLotteries({ polla_organization_id: organizationId ?? undefined });
  const { data: schedules } = useSchedules({ polla_organization_id: organizationId ?? undefined });

  const { mutate: createBet, isPending } = useCreateBet();

  const lotteryById = useMemo(
    () => new Map(lotteries?.data.map((l) => [l.polla_lottery_id, l.name])),
    [lotteries]
  );
  const scheduleById = useMemo(
    () => new Map(schedules?.data.map((s) => [s.polla_schedule_id, s.name])),
    [schedules]
  );

  const loadable = editions?.data ?? [];
  const edition = loadable.find((e) => e.polla_edition_id === editionId);

  const editionLabel = (item: IPollaEditionEntityFront) =>
    `${lotteryById.get(item.polla_lottery_id) ?? ''} · ${
      scheduleById.get(item.polla_schedule_id) ?? ''
    } (${fmtDate(item.start_date)} al ${fmtDate(item.end_date)}) · $${fmtMoney(item.ticket_price)}`;

  const handleSubmit = (values: string[] = numbers) => {
    if (isPending) return;

    if (!edition) {
      toast.error('Elegí una edición');
      return;
    }

    if (canManage && !target) {
      toast.error('Escribí el número del pasador o jugador');
      return;
    }

    if (isCashier && targetNumber && !target) {
      toast.error('No hay un jugador tuyo con ese número');
      return;
    }

    const error = pollaNumbersError(values);
    if (error) {
      toast.error(error);
      return;
    }

    createBet(
      {
        polla_edition_id: edition.polla_edition_id,
        numbers: values,
        ...(pickTarget && target ? { polla_user_id: target.polla_user_id } : {}),
      },
      {
        onSuccess: async (bet) => {
          setNumbers(createEmptyPollaNumbers());
          // Listo para cargar el próximo ticket sin tocar el mouse.
          boxesRef.current?.focusFirst();

          const { blob, fileName } = await makePollaTicketPdf({
            ticket_number: bet.ticket_number,
            user_name: bet.user_name,
            cashier_number: bet.cashier_number ?? undefined,
            numbers: bet.numbers,
            lotteryName: lotteryById.get(edition.polla_lottery_id) ?? '',
            scheduleName: scheduleById.get(edition.polla_schedule_id) ?? '',
            startDate: edition.start_date,
            endDate: edition.end_date,
            loadDate: bet.load_date,
            ticketPrice: Number(bet.amount),
            poolAmount: Number(edition.pool_amount),
          });

          await deliverPdf(blob, fileName, `Ticket Polla ${bet.ticket_number}`);
        },
      }
    );
  };

  return (
    // Sin encabezado: la pantalla entra completa en 480px de alto y no hace
    // falta scrollear para llegar al botón de cargar.
    <div className="mx-auto max-w-2xl">
      {loadable.length === 0 ? (
        <EmptyState message="No hay ediciones abiertas para carga en este momento" />
      ) : (
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground sm:gap-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-end justify-between gap-2">
              <Label>Edición</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setRepeatOpen(true)}>
                <Repeat2 />
                {isPlayer ? 'Repetir última jugada' : 'Repetir ticket'}
              </Button>
            </div>
            <Select value={editionId} onValueChange={setEditionId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí una edición" />
              </SelectTrigger>
              <SelectContent>
                {loadable.map((item) => (
                  <SelectItem key={item.polla_edition_id} value={item.polla_edition_id}>
                    {editionLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {edition && (
              <p className="text-xs text-muted-foreground">
                Pozo ${fmtMoney(edition.pool_amount)} · cierre de carga{' '}
                {fmtDate(edition.load_limit_date)}
              </p>
            )}
          </div>

          {pickTarget && (
            <TargetUserByNumber
              value={targetNumber}
              onChange={setTargetNumber}
              onResolved={setTarget}
              organizationId={organizationId}
              emptyHint={
                canManage
                  ? 'Escribí el número del pasador o jugador'
                  : 'Vacío: la jugada va a tu nombre'
              }
              onEnter={() => boxesRef.current?.focusFirst()}
            />
          )}

          <PollaNumberBoxes
            ref={boxesRef}
            values={numbers}
            onChange={setNumbers}
            onSubmit={handleSubmit}
          />

          <Button type="button" onClick={() => handleSubmit()} disabled={isPending}>
            {isPending ? 'Cargando…' : 'Cargar jugada'}
          </Button>
        </div>
      )}

      {repeatOpen && (
        <RepeatBetDialog
          open={repeatOpen}
          mode={isPlayer ? 'last' : 'ticket'}
          onClose={() => setRepeatOpen(false)}
          editions={loadable}
          editionLabel={editionLabel}
          defaultEditionId={editionId}
          onApply={(repeat) => {
            setEditionId(repeat.editionId);
            setNumbers(repeat.numbers);
          }}
        />
      )}
    </div>
  );
};

export default MakeBetPage;
