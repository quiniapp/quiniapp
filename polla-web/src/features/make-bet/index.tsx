import { useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Repeat2 } from 'lucide-react';
import {
  IPollaBetEntityBack,
  IPollaEditionEntityFront,
  POLLA_BET_IDENTIFIER_MAX,
  POLLA_EDITION_STATUS,
  pollaTicketCashierCode,
} from '@helper/polla/types/game.type';
import {
  IPollaUserOption,
  POLLA_USER_TYPE,
  isPollaLoaderRole,
  isPollaSuperRole,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditions } from '@/hooks/fetchs/usePollaData';
import { useLotteries, useSchedules } from '@/hooks/fetchs/useCatalogs';
import { useCreateBet } from '@/hooks/mutations/usePollaMutations';
import { PollaNumberBoxes, PollaNumberBoxesHandle } from '@/components/PollaNumberBoxes';
import { UserSearchPicker } from '@/components/UserSearchPicker';
import { createEmptyPollaNumbers, pollaNumbersError } from '@/lib/pollaNumbers';
import { EmptyState } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PollaTicketData, makePollaTicketsPdf } from '@/functions/makePollaTicket';
import { deliverPdf } from '@/functions/printPdf';
import { RepeatBetDialog } from './RepeatBetDialog';

const fmtDate = (value: string) => dayjs(value).format('DD-MM-YYYY');
/** `HH:mm:ss` de la base → `HH:mm`. */
const fmtTime = (value: string) => value.slice(0, 5);
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(value));
/** `YYYY-MM-DDTHH:mm:ss` (Argentina) → `DD-MM-YYYY HH:mm`. */
/** Lo que el ticket impreso necesita de la jugada. */
type TicketBet = Pick<
  IPollaBetEntityBack,
  | 'ticket_number'
  | 'user_name'
  | 'identifier'
  | 'cashier_number'
  | 'numbers'
  | 'load_date'
  | 'amount'
  | 'is_free'
>;

const fmtCutoff = (value: string) => `${fmtDate(value.slice(0, 10))} ${value.slice(11, 16)}`;

export const MakeBetPage = () => {
  const { role, organizationId } = useAuth();

  // Owner, capitalista, superadmin, Super y admin no juegan a su nombre:
  // siempre cargan para un pasador o un jugador (el admin, de su grupo). El
  // pasador carga a su nombre o al de sus jugadores; el jugador, al suyo.
  const isLoader = Boolean(role && isPollaLoaderRole(role));
  const isSuper = Boolean(role && isPollaSuperRole(role));
  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  const isPlayer = role === POLLA_USER_TYPE.PLAYER;

  const [editionId, setEditionId] = useState('');
  const [target, setTarget] = useState<IPollaUserOption | null>(null);
  // "Pasador | Jugador" del buscador de quienes cargan a nombre de otro.
  const [targetType, setTargetType] = useState(POLLA_USER_TYPE.CASHIER);
  const [identifier, setIdentifier] = useState('');
  const [numbers, setNumbers] = useState<string[]>(createEmptyPollaNumbers());
  const [repeatOpen, setRepeatOpen] = useState(false);
  const boxesRef = useRef<PollaNumberBoxesHandle>(null);
  const identifierRef = useRef<HTMLInputElement>(null);

  // Todo ticket lleva jugador o identificador: a nombre de un pasador (el
  // pasador a su nombre, o quien carga para un pasador) el identificador es
  // obligatorio; a nombre de un jugador, opcional (la base lo vuelve a exigir).
  const showIdentifier = !isPlayer;
  const identifierRequired =
    (isCashier && !target) || (isLoader && targetType === POLLA_USER_TYPE.CASHIER);

  // Las que tienen la carga abierta ahora para el rol (hora de Argentina):
  // pasador y jugador hasta el cierre; el admin hasta el turno más tarde del
  // día de cierre; superadmin+ hasta el último día de juego.
  const { data: editions } = useEditions({
    status: POLLA_EDITION_STATUS.ACTIVE,
    loadable: true,
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
  // Con la polla en juego (solo superadmin+ llega acá), la jugada no suma los
  // aciertos de los sorteos ya procesados hasta que se regeneran a mano.
  const isPlaying = Boolean(edition && edition.start_date <= dayjs().format('YYYY-MM-DD'));

  const ticketDataOf = (bet: TicketBet, of: IPollaEditionEntityFront): PollaTicketData => ({
    ticket_number: bet.ticket_number,
    user_name: bet.user_name,
    identifier: bet.identifier,
    cashier_code: pollaTicketCashierCode(bet.ticket_number, bet.cashier_number) || undefined,
    numbers: bet.numbers,
    lotteryName: lotteryById.get(of.polla_lottery_id) ?? '',
    scheduleName: scheduleById.get(of.polla_schedule_id) ?? '',
    startDate: of.start_date,
    endDate: of.end_date,
    loadDate: bet.load_date,
    ticketPrice: Number(bet.amount),
    poolAmount: Number(of.pool_amount),
    surprisePoolAmount: Number(of.surprise_pool_amount ?? 0),
    isFree: Boolean(bet.is_free),
  });

  /** Tickets recién cargados: un PDF (con uno o varios) para imprimir o compartir. */
  const printTickets = async (bets: TicketBet[], of: IPollaEditionEntityFront) => {
    if (bets.length === 0) return;
    const { blob, fileName } = await makePollaTicketsPdf(bets.map((bet) => ticketDataOf(bet, of)));
    await deliverPdf(
      blob,
      fileName,
      bets.length === 1 ? `Ticket Polla ${bets[0].ticket_number}` : `${bets.length} tickets Polla`
    );
  };

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

    if (isLoader && !target) {
      toast.error(targetType === POLLA_USER_TYPE.CASHIER ? 'Elegí el pasador' : 'Elegí el jugador');
      return;
    }

    const cleanIdentifier = identifier.trim();
    if (identifierRequired && !cleanIdentifier) {
      toast.error(
        isCashier
          ? 'Poné el identificador o elegí uno de tus jugadores'
          : 'Poné el identificador del ticket'
      );
      identifierRef.current?.focus();
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
        ...(target ? { polla_user_id: target.polla_user_id } : {}),
        ...(cleanIdentifier ? { identifier: cleanIdentifier } : {}),
      },
      {
        onSuccess: async (bet) => {
          setNumbers(createEmptyPollaNumbers());
          // Listo para cargar el próximo ticket sin tocar el mouse.
          boxesRef.current?.focusFirst();

          await printTickets([bet], edition);
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
                {isPlayer ? 'Repetir mis tickets' : 'Repetir ticket'}
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
                Pozo ${fmtMoney(edition.pool_amount)}
                {Number(edition.surprise_pool_amount ?? 0) > 0 && (
                  <span className="font-semibold text-success">
                    {` + sorpresa $${fmtMoney(edition.surprise_pool_amount)}`}
                  </span>
                )}
                {` · cierre de carga ${fmtDate(edition.load_limit_date)} ${fmtTime(edition.load_limit_time)}`}
                {isSuper && ` · vos podés cargar hasta el ${fmtDate(edition.end_date)}`}
                {role === POLLA_USER_TYPE.ADMIN &&
                  edition.my_load_cutoff &&
                  ` · vos podés cargar hasta el ${fmtCutoff(edition.my_load_cutoff)}`}
              </p>
            )}
            {isSuper && isPlaying && (
              <p className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-xs">
                La edición ya está en juego: para que esta jugada sume los aciertos de los sorteos
                anteriores, volvé a generar los ganadores de esos días en Resultados.
              </p>
            )}
          </div>

          {isLoader && (
            <UserSearchPicker
              id="target-user"
              label="Cargar a nombre de"
              userTypes={[POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER]}
              typeFilter={{
                value: targetType,
                onChange: (type) => {
                  setTargetType(type);
                  setTarget(null);
                },
              }}
              value={target}
              onChange={setTarget}
              placeholder={
                targetType === POLLA_USER_TYPE.CASHIER
                  ? 'Número (o grupo-número) o nombre del pasador'
                  : 'Número o nombre del jugador'
              }
              emptyHint="Escribí el número o elegilo de la lista"
              scope={{ writable: true }}
              clearOnType
              onEnter={() => identifierRef.current?.focus()}
            />
          )}

          {isCashier && (
            <UserSearchPicker
              id="target-user"
              label="Cargar a nombre de"
              userTypes={[POLLA_USER_TYPE.PLAYER]}
              value={target}
              onChange={setTarget}
              placeholder="A tu nombre · número o nombre del jugador"
              emptyHint="A tu nombre. Elegí uno de tus jugadores para cargarle a él."
              clearLabel="A mi nombre"
              scope={{ writable: true }}
              onEnter={() => identifierRef.current?.focus()}
            />
          )}

          {showIdentifier && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="bet-identifier">
                Identificador{' '}
                <span className="font-normal text-muted-foreground">
                  {identifierRequired ? '(obligatorio)' : '(opcional)'}
                </span>
              </Label>
              <Input
                ref={identifierRef}
                id="bet-identifier"
                value={identifier}
                maxLength={POLLA_BET_IDENTIFIER_MAX}
                autoComplete="off"
                placeholder="De quién es el ticket, por ejemplo: chicho"
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    boxesRef.current?.focusFirst();
                  }
                }}
              />
            </div>
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
          mode={isPlayer ? 'mine' : 'ticket'}
          onClose={() => setRepeatOpen(false)}
          editions={loadable}
          editionLabel={editionLabel}
          defaultEditionId={editionId}
          onCreated={printTickets}
        />
      )}
    </div>
  );
};

export default MakeBetPage;
