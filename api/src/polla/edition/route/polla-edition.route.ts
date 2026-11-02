import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { POLLA_SUPER_ROLES, isPollaSuperRole } from '@helper/polla/types/user.type';
import {
  IPollaEditionEntityBack,
  POLLA_EDITION_PERIOD,
  POLLA_EDITION_STATUS,
} from '@helper/polla/types/game.type';
import { newPollaEditionSchema, updatePollaEditionSchema } from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaEditionRepository } from '../repository/polla-edition.repository';
import { buildPaginated, parsePagination } from '../../helper/pagination';
import { pollaToday } from '../../helper/date';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

/**
 * Recaudado y cantidad de jugadas son totales de toda la organización: solo
 * los ve superadmin+ (el admin de grupo no ve la plata de los demás grupos).
 */
const withoutTotals = <T extends IPollaEditionEntityBack>(edition: T) => {
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

  /** Las ediciones (y su pozo) son de toda la organización: las escribe superadmin+. */
  private setupRoutes() {
    const writeGuard = requirePollaRole(...POLLA_SUPER_ROLES);

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
    const isSuper = isPollaSuperRole(user.user_type);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);

    // Carga abierta ahora mismo para el rol (fecha y hora de Argentina), cada
    // una con su corte: pasador y jugador, el de la edición; el admin, el del
    // turno más tarde; superadmin+, hasta el último día de juego.
    if (req.query.loadable === 'true') {
      const rows = await this.repository.getLoadable(organizationId, user.user_type);
      const data = isSuper ? rows : rows.map(withoutTotals);
      res.status(200).json({
        data: {
          editions: buildPaginated(
            data,
            { ...pagination, page: 1, limit: data.length },
            data.length
          ),
        },
      });
      return;
    }

    const loadableOn =
      typeof req.query.loadable_on === 'string' ? req.query.loadable_on : undefined;
    const periods = parsePeriods(req.query.periods);

    const result = await this.repository.getAll(
      {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        status: req.query.status as POLLA_EDITION_STATUS | undefined,
        playingOn: typeof req.query.playing_on === 'string' ? req.query.playing_on : undefined,
        loadableOn,
        periods: periods ? { list: periods, today: pollaToday() } : undefined,
      },
      pagination
    );

    const editions = result.data as IPollaEditionEntityBack[];
    const data = isSuper ? editions : editions.map(withoutTotals);

    res.status(200).json({ data: { editions: { ...result, data } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const edition = await this.assertScope(req, req.params.id);

    res.status(200).json({
      data: { edition: isPollaSuperRole(user.user_type) ? edition : withoutTotals(edition) },
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

  /**
   * Superadmin+ cambia precio, fechas, horas, pozo y pozo sorpresa. Cada
   * jugada guarda el precio con el que se cargó: un precio nuevo vale para las
   * que se carguen después. Extender una edición que terminó sin ganador la
   * vuelve a poner en juego (la carga no se reabre). Las reglas las controla
   * la base (`polla_update_edition`).
   */
  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const edition = await this.assertScope(req, req.params.id);
    const payload = updatePollaEditionSchema.parse(req.body);

    // Con una sola fecha nueva, el control de fechas se hace contra la otra.
    const start = payload.start_date ?? edition.start_date;
    const end = payload.end_date ?? edition.end_date;
    if (start > end) {
      throw new BadRequestError('La fecha de fin debe ser posterior o igual a la fecha de inicio');
    }
    if ((payload.load_limit_date ?? edition.load_limit_date) > start) {
      throw new BadRequestError('El cierre de carga no puede ser después de la fecha de inicio');
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
