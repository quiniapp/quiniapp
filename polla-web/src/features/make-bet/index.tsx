import { useRef, useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { Repeat2 } from 'lucide-react';
import {
  IPollaBetEntityBack,
  IPollaEditionEntityFront,
  POLLA_BET_IDENTIFIER_MAX,
  POLLA_BET_GAME_STATUS_LABEL,
  POLLA_EDITION_STATUS,
  POLLA_PAYMENT_STATUS,
  POLLA_PAYMENT_STATUS_LABEL,
  isPollaSpecialEdition,
  pollaBetGameStatus,
  pollaEditionDrawLabels,
  pollaEditionTitle,
  pollaPrizeRuleLabel,
  pollaTicketCashierCode,
} from '@helper/polla/types/game.type';
import {
  IPollaUserOption,
  POLLA_USER_TYPE,
  isPollaLoaderRole,
} from '@helper/polla/types/user.type';
import { useAuth } from '@/providers/AuthContext';
import { useEditions } from '@/hooks/fetchs/usePollaData';
import { useDrawCatalogs } from '@/hooks/fetchs/useCatalogs';
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
import { deliverPdf, sharePdf } from '@/functions/printPdf';
import { RepeatBetDialog } from './RepeatBetDialog';
import { PaymentDialog } from './PaymentDialog';
import { Badge } from '@/components/ui/badge';
import { fmtDateTime } from '@/features/bets/format';

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
  | 'payment_status'
  | 'created_at'
  | 'winner'
>;

const fmtCutoff = (value: string) => `${fmtDate(value.slice(0, 10))} ${value.slice(11, 16)}`;

export const MakeBetPage = () => {
  const { role, organizationId } = useAuth();

  // Owner, capitalista, superadmin, Super y admin no juegan a su nombre:
  // siempre cargan para un pasador o un jugador (el admin, de su grupo). El
  // pasador carga a su nombre o al de sus jugadores; el jugador, al suyo.
  const isLoader = Boolean(role && isPollaLoaderRole(role));
  const isCashier = role === POLLA_USER_TYPE.CASHIER;
  const isPlayer = role === POLLA_USER_TYPE.PLAYER;
  const isAssistant = role === POLLA_USER_TYPE.ASSISTANT;

  const [editionId, setEditionId] = useState('');
  const [target, setTarget] = useState<IPollaUserOption | null>(null);
  // "Pasador | Jugador" del buscador de quienes cargan a nombre de otro.
  const [targetType, setTargetType] = useState(POLLA_USER_TYPE.CASHIER);
  const [identifier, setIdentifier] = useState('');
  const [numbers, setNumbers] = useState<string[]>(createEmptyPollaNumbers());
  const [repeatOpen, setRepeatOpen] = useState(false);
  // Números listos para cerrar: mientras hay, se elige Efectivo o Debe.
  const [closing, setClosing] = useState<string[] | null>(null);
  // Lo último que se cargó: número, fecha y hora, y estado (R10).
  const [lastTickets, setLastTickets] = useState<TicketBet[]>([]);
  const boxesRef = useRef<PollaNumberBoxesHandle>(null);
  const identifierRef = useRef<HTMLInputElement>(null);

  // Todo ticket lleva jugador o identificador: a nombre de un pasador (el
  // pasador a su nombre, o quien carga para un pasador) el identificador es
  // obligatorio; a nombre de un jugador, opcional (la base lo vuelve a exigir).
  const showIdentifier = !isPlayer;
  const identifierRequired =
    (isCashier && !target) || (isLoader && targetType === POLLA_USER_TYPE.CASHIER);

  // Las que tienen la carga abierta ahora para el rol (hora de Argentina, R30):
  // todos desde el inicio hasta el cierre de carga, salvo el admin de grupo,
  // que carga hasta la hora del sorteo.
  const { data: editions } = useEditions({
    status: POLLA_EDITION_STATUS.ACTIVE,
    loadable: true,
    polla_organization_id: organizationId ?? undefined,
  });
  // Las activas que todavía no abrieron la carga (R29): sin nada abierto se
  // avisa cuándo abre la próxima.
  const { data: activeEditions } = useEditions({
    status: POLLA_EDITION_STATUS.ACTIVE,
    polla_organization_id: organizationId ?? undefined,
  });
  const catalogs = useDrawCatalogs(organizationId);

  const { mutate: createBet, isPending } = useCreateBet();

  const loadable = editions?.data ?? [];
  // Con una sola edición abierta queda elegida; con varias (la regular y la
  // especial de la misma semana) se elige a mano.
  const selectedEditionId =
    editionId || (loadable.length === 1 ? loadable[0].polla_edition_id : '');
  const edition = loadable.find((e) => e.polla_edition_id === selectedEditionId);

  const ticketDataOf = (bet: TicketBet, of: IPollaEditionEntityFront): PollaTicketData => ({
    ticket_number: bet.ticket_number,
    user_name: bet.user_name,
    identifier: bet.identifier,
    cashier_code: pollaTicketCashierCode(bet.ticket_number, bet.cashier_number) || undefined,
    numbers: bet.numbers,
    editionName: of.name,
    drawLines: pollaEditionDrawLabels(of, catalogs),
    startDate: of.start_date,
    endDate: of.end_date,
    loadDate: bet.load_date,
    loadedAt: bet.created_at,
    ticketPrice: Number(bet.amount),
    poolAmount: Number(of.pool_amount),
    surprisePoolAmount: Number(of.surprise_pool_amount ?? 0),
    isFree: Boolean(bet.is_free),
    // El ticket del jugador no dice si está pagado.
    paymentStatus: isPlayer ? undefined : bet.payment_status,
  });

  /**
   * Tickets recién cargados: un PDF (con uno o varios). El pasador y el staff
   * lo imprimen (o lo comparten en mobile); el jugador no imprime: lo guarda o
   * lo comparte.
   */
  const printTickets = async (bets: TicketBet[], of: IPollaEditionEntityFront) => {
    if (bets.length === 0) return;
    setLastTickets(bets);
    // R12: el Súper carga planillas en serie. No se abre la impresión: un
    // aviso con el número de ticket (lo puede reimprimir desde Administrar).
    if (isAssistant) {
      toast.success(
        bets.length === 1
          ? `Ticket ${bets[0].ticket_number} cargado`
          : `${bets.length} tickets cargados: ${bets.map((bet) => bet.ticket_number).join(', ')}`,
        { duration: 6000 }
      );
      return;
    }
    const { blob, fileName } = await makePollaTicketsPdf(bets.map((bet) => ticketDataOf(bet, of)));
    const text =
      bets.length === 1 ? `Ticket Polla ${bets[0].ticket_number}` : `${bets.length} tickets Polla`;
    if (isPlayer) {
      await sharePdf(blob, fileName, text);
      return;
    }
    await deliverPdf(blob, fileName, text);
  };

  // Con todos sus sorteos: en la especial se ve que juega con las 5 quinielas.
  const nowMoment = dayjs().format('YYYY-MM-DDTHH:mm:ss');
  const upcoming = (activeEditions?.data ?? [])
    .filter((item) => `${item.load_start_date}T${item.load_start_time}` > nowMoment)
    .sort((a, b) =>
      `${a.load_start_date}T${a.load_start_time}`.localeCompare(
        `${b.load_start_date}T${b.load_start_time}`
      )
    );

  const editionLabel = (item: IPollaEditionEntityFront) =>
    `${pollaEditionTitle(item, catalogs)} (${fmtDate(item.start_date)} al ${fmtDate(
      item.end_date
    )}) · $${fmtMoney(item.ticket_price)}`;

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

    // El jugador no elige: su ticket queda en Debe (lo cobra su pasador).
    if (isPlayer) {
      closeTicket(values);
      return;
    }
    setClosing(values);
  };

  /** Carga el ticket con el pago elegido (sin pago: el jugador, en Debe). */
  const closeTicket = (values: string[], paymentStatus?: POLLA_PAYMENT_STATUS) => {
    if (!edition) return;
    const cleanIdentifier = identifier.trim();

    createBet(
      {
        polla_edition_id: edition.polla_edition_id,
        numbers: values,
        ...(target ? { polla_user_id: target.polla_user_id } : {}),
        ...(cleanIdentifier ? { identifier: cleanIdentifier } : {}),
        ...(paymentStatus ? { payment_status: paymentStatus } : {}),
      },
      {
        onSuccess: async (bet) => {
          setClosing(null);
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
        <div className="flex flex-col gap-2">
          <EmptyState message="No hay ediciones abiertas para carga en este momento" />
          {upcoming.length > 0 && (
            <ul className="flex flex-col gap-1 text-center text-sm text-muted-foreground">
              {upcoming.map((item) => (
                <li key={item.polla_edition_id}>
                  La carga de {pollaEditionTitle(item, catalogs)} abre el{' '}
                  {fmtDate(item.load_start_date)} a las {fmtTime(item.load_start_time)}.
                </li>
              ))}
            </ul>
          )}
        </div>
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
            <Select value={selectedEditionId} onValueChange={setEditionId}>
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
                {role === POLLA_USER_TYPE.ADMIN &&
                  edition.my_load_cutoff &&
                  ` · vos podés cargar hasta el ${fmtCutoff(edition.my_load_cutoff)}`}
              </p>
            )}
            {/* En el selector el nombre se corta: los sorteos de la especial van completos acá. */}
            {edition && isPollaSpecialEdition(edition) && (
              <p className="text-xs">
                <span className="font-semibold">Juega con:</span>{' '}
                {pollaEditionDrawLabels(edition, catalogs).join(', ')}.{' '}
                {pollaPrizeRuleLabel(edition)}.
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
            {isPending ? 'Cargando…' : 'Cerrar ticket'}
          </Button>

          {lastTickets.length > 0 && (
            <div role="status" className="rounded-md border p-3 text-sm">
              <p className="mb-1 font-medium">
                {lastTickets.length === 1
                  ? 'Último ticket cargado'
                  : `Últimos ${lastTickets.length} tickets cargados`}
              </p>
              <ul className="flex flex-col gap-1">
                {lastTickets.map((bet) => (
                  <li
                    key={bet.ticket_number}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1"
                  >
                    <span className="font-mono text-xs">{bet.ticket_number}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtDateTime(bet.created_at)}
                    </span>
                    <Badge variant="secondary">
                      {POLLA_BET_GAME_STATUS_LABEL[pollaBetGameStatus(bet)]}
                    </Badge>
                    {/* El jugador no ve el estado de pago. */}
                    {!isPlayer && !bet.is_free && (
                      <Badge
                        variant={
                          bet.payment_status === POLLA_PAYMENT_STATUS.OWED
                            ? 'destructive'
                            : 'success'
                        }
                      >
                        {POLLA_PAYMENT_STATUS_LABEL[bet.payment_status]}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {closing && (
        <PaymentDialog
          pending={isPending}
          onChoose={(status) => closeTicket(closing, status)}
          onClose={() => {
            setClosing(null);
            boxesRef.current?.focusFirst();
          }}
        />
      )}

      {repeatOpen && (
        <RepeatBetDialog
          open={repeatOpen}
          mode={isPlayer ? 'mine' : 'ticket'}
          choosePayment={!isPlayer}
          prints={!isAssistant}
          onClose={() => setRepeatOpen(false)}
          editions={loadable}
          editionLabel={editionLabel}
          defaultEditionId={selectedEditionId}
          onCreated={printTickets}
        />
      )}
    </div>
  );
};

export default MakeBetPage;
