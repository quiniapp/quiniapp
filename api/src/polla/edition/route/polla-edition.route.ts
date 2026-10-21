import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { POLLA_USER_TYPE, isPollaAdminRole } from '@helper/polla/types/user.type';
import {
  IPollaEditionEntityBack,
  POLLA_EDITION_PERIOD,
  POLLA_EDITION_STATUS,
} from '@helper/polla/types/game.type';
import { newPollaEditionSchema, updatePollaEditionSchema } from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaEditionRepository } from '../repository/polla-edition.repository';
import { parsePagination } from '../../helper/pagination';
import { pollaNowTime, pollaToday } from '../../helper/date';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ADMIN_AND_UP = [
  POLLA_USER_TYPE.OWNER,
  POLLA_USER_TYPE.CAPITALIST,
  POLLA_USER_TYPE.SUPERADMIN,
  POLLA_USER_TYPE.ADMIN,
];

/** Recaudado y cantidad de jugadas son totales: solo los ve un admin. */
const withoutTotals = (edition: IPollaEditionEntityBack) => {
  const { bets_count: _count, collected_amount: _collected, ...rest } = edition;
  void _count;
  void _collected;
  return rest;
};

const PERIODS = Object.values(POLLA_EDITION_PERIOD);

/**
 * `periods=UPCOMING,PLAYING` → la lista validada. Sin filtro si no viene o
 * vienen los tres (es lo mismo que traer todas).
 */
const parsePeriods = (raw: unknown): POLLA_EDITION_PERIOD[] | undefined => {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;

  const list = [...new Set(raw.split(',').map((value) => value.trim()))];
  if (list.some((value) => !PERIODS.includes(value as POLLA_EDITION_PERIOD))) {
    throw new BadRequestError('Período inválido');
  }

  return list.length < PERIODS.length ? (list as POLLA_EDITION_PERIOD[]) : undefined;
};

export class PollaEditionRouter {
  public router: Router;

  private repository = new PollaEditionRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const writeGuard = requirePollaRole(...ADMIN_AND_UP);

    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.post('/', writeGuard, this.createHandler);
    this.router.put('/:id', writeGuard, this.updateHandler);
    this.router.delete('/:id', writeGuard, this.deleteHandler);
  }

  private assertScope = async (req: Request, editionId: string) => {
    const { user } = getPollaSession(req);
    const edition = await this.repository.getById(editionId);

    if (edition.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La edición pertenece a otra organización');
    }

    return edition;
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const isAdmin = isPollaAdminRole(user.user_type);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    // Carga abierta ahora mismo, con la fecha y hora de Argentina del servidor.
    // ADMIN+ no tiene cierre de carga: hasta el último día de juego.
    const loadable = req.query.loadable === 'true';
    const loadableOn =
      typeof req.query.loadable_on === 'string' ? req.query.loadable_on : undefined;
    const periods = parsePeriods(req.query.periods);

    const result = await this.repository.getAll(
      {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        status: req.query.status as POLLA_EDITION_STATUS | undefined,
        playingOn: typeof req.query.playing_on === 'string' ? req.query.playing_on : undefined,
        loadableOn,
        adminLoadableOn: loadable && isAdmin ? pollaToday() : undefined,
        loadableAt: loadable && !isAdmin ? { date: pollaToday(), time: pollaNowTime() } : undefined,
        periods: periods ? { list: periods, today: pollaToday() } : undefined,
      },
      pagination
    );

    const data = isAdmin ? result.data : result.data.map(withoutTotals);

    res.status(200).json({ data: { editions: { ...result, data } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const edition = await this.assertScope(req, req.params.id);

    res.status(200).json({
      data: { edition: isPollaAdminRole(user.user_type) ? edition : withoutTotals(edition) },
    });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = newPollaEditionSchema.parse(req.body);

    const created = await this.repository.create({
      ...payload,
      polla_organization_id: resolveOrganizationId(user, payload.polla_organization_id),
    });

    res.status(201).json({ data: { edition: created } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const edition = await this.assertScope(req, req.params.id);
    const payload = updatePollaEditionSchema.parse(req.body);

    // Cada jugada guarda el precio con el que se cargó y la cuenta corriente
    // suma ese monto: cambiar el precio con jugadas cargadas desfasa el pase.
    if (
      payload.ticket_price !== undefined &&
      Number(payload.ticket_price) !== Number(edition.ticket_price) &&
      edition.bets_count > 0
    ) {
      throw new BadRequestError(
        'No se puede cambiar el precio del ticket: la edición ya tiene jugadas cargadas'
      );
    }

    const updated = await this.repository.update(req.params.id, payload);
    res.status(200).json({ data: { edition: updated } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertScope(req, req.params.id);
    const result = await this.repository.remove(req.params.id, user.polla_user_id);
    res.status(200).json({ data: { success: true, voided_bets: result.voided_bets } });
  });
}
