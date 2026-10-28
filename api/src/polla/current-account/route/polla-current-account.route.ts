import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { POLLA_ACCOUNT_RECALC_MAX_DAYS } from '@helper/polla/config/session.config';
import { POLLA_LIQUIDATION_NO_GROUP as LIQUIDATION_NO_GROUP } from '@helper/polla/types/game.type';
import {
  pollaCurrentAccountUpdateSchema,
  pollaCurrentAccountBulkUpdateSchema,
} from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaCurrentAccountRepository } from '../repository/polla-current-account.repository';
import { buildPaginated, parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const DAY_MS = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inicio de la liquidación por rango (`range_from`), hasta `date` inclusive y
 * de hasta un período de recálculo. Sin `range_from`, cada pasador acumula
 * desde el día siguiente a su última liquidación.
 */
const parseRangeFrom = (value: unknown, date: string): string | null => {
  const from = queryString(value);
  if (!from) return null;

  if (!ISO_DATE.test(from) || from > date) {
    throw new BadRequestError('Rango de fechas inválido');
  }
  if ((Date.parse(date) - Date.parse(from)) / DAY_MS > POLLA_ACCOUNT_RECALC_MAX_DAYS) {
    throw new BadRequestError(`El rango no puede pasar de ${POLLA_ACCOUNT_RECALC_MAX_DAYS} días`);
  }

  return from;
};

export class PollaCurrentAccountRouter {
  public router: Router;

  private repository = new PollaCurrentAccountRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Ven la cuenta corriente y liquidan dueño, capitalista y superadmin
   * (`POLLA_ACCOUNT_ROLES`); el pasador solo ve la suya. El admin y el
   * jugador no tienen acceso.
   */
  private setupRoutes() {
    const readGuard = requirePollaRole(...POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE.CASHIER);
    const writeGuard = requirePollaRole(...POLLA_ACCOUNT_ROLES);

    this.router.post('/calculate', writeGuard, this.calculateHandler);
    this.router.post('/liquidate', writeGuard, this.liquidateHandler);
    this.router.put('/bulk', writeGuard, this.bulkUpdateHandler);
    this.router.get('/totals', readGuard, this.getTotalsHandler);
    this.router.get('/', readGuard, this.getAllHandler);
    this.router.get('/:id', readGuard, this.getByIdHandler);
    this.router.put('/:id', writeGuard, this.updateHandler);
  }

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const date = queryString(req.query.date);

    const filters = {
      // El pasador solo ve su propia cuenta.
      userId:
        user.user_type === POLLA_USER_TYPE.CASHIER
          ? user.polla_user_id
          : queryString(req.query.polla_user_id),
      userNumber: /^\d{1,9}$/.test(String(req.query.user_number ?? ''))
        ? Number(req.query.user_number)
        : null,
      groupId: queryString(req.query.polla_group_id),
    };

    // Un día: cada fila trae además los montos acumulados de su período (o
    // del rango que arranca en `range_from`).
    if (date) {
      if (!ISO_DATE.test(date)) throw new BadRequestError('Fecha inválida (YYYY-MM-DD)');

      const rows = await this.repository.getPeriodRows({
        ...filters,
        organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
        date,
        from: parseRangeFrom(req.query.range_from, date),
      });

      res.status(200).json({
        data: {
          current_accounts: buildPaginated(
            rows,
            { ...pagination, page: 1, limit: rows.length },
            rows.length
          ),
        },
      });
      return;
    }

    const result = await this.repository.getAll(
      {
        ...filters,
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        from: queryString(req.query.from) ?? undefined,
        to: queryString(req.query.to) ?? undefined,
      },
      pagination
    );

    res.status(200).json({ data: { current_accounts: result } });
  });

  /**
   * Totales por día entre `from` y `to`: el pie de la tabla (from = to), el
   * ticket de cobros y pagos, el resumen y los subtotales. El pasador solo
   * recibe los suyos.
   */
  private getTotalsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const from = queryString(req.query.from);
    const to = queryString(req.query.to) ?? from;

    if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
      throw new BadRequestError('Rango de fechas inválido (YYYY-MM-DD)');
    }

    const totals = await this.repository.getDailyTotals({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      from,
      to,
      groupId: queryString(req.query.polla_group_id),
      userId: user.user_type === POLLA_USER_TYPE.CASHIER ? user.polla_user_id : null,
    });

    res.status(200).json({ data: { totals } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const account = await this.repository.getById(req.params.id);

    if (account.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La cuenta pertenece a otra organización');
    }

    if (
      user.user_type === POLLA_USER_TYPE.CASHIER &&
      account.polla_user_id !== user.polla_user_id
    ) {
      throw new ForbiddenError('Solo podés ver tu propia cuenta corriente');
    }

    res.status(200).json({ data: { current_account: account } });
  });

  /**
   * "Actualizar" recalcula el período abierto (desde la última liquidación de
   * cada pasador) hasta la fecha, no solo ese día: lo jugado en la semana se
   * acumula. Liquidar además cierra en esa fecha el período de los pasadores
   * de un grupo (`polla_group_id`, o `none` para los sin grupo): los números
   * de pasador se repiten entre grupos, así que se ven todos pero se liquida
   * por grupo. Con `range_from` (liquidación por rango) devuelve los montos de
   * ese rango; se liquida igual en la fecha, que es el Hasta. La liquidación
   * de Polla no tiene deje.
   */
  private runCalculation = async (req: Request, liquidated: boolean) => {
    const { user } = getPollaSession(req);
    const date = req.query.date ?? req.body?.date;

    if (typeof date !== 'string' || !ISO_DATE.test(date)) {
      throw new BadRequestError('Falta la fecha (YYYY-MM-DD)');
    }

    const from = parseRangeFrom(req.query.range_from ?? req.body?.range_from, date);
    const organizationId = resolveOrganizationId(
      user,
      req.query.polla_organization_id ?? req.body?.polla_organization_id
    );

    const groupParam = req.body?.polla_group_id ?? req.query.polla_group_id;
    if (
      liquidated &&
      !(
        groupParam === LIQUIDATION_NO_GROUP ||
        (typeof groupParam === 'string' && UUID.test(groupParam))
      )
    ) {
      throw new BadRequestError('Elegí el grupo a liquidar');
    }

    await this.repository.recalculateOpenPeriod(organizationId, date);
    if (liquidated) {
      await this.repository.markDayLiquidated(
        organizationId,
        date,
        groupParam === LIQUIDATION_NO_GROUP ? null : groupParam
      );
    }

    return this.repository.getPeriodRows({ organizationId, date, from });
  };

  private calculateHandler = asyncHandler(async (req: Request, res: Response) => {
    const accounts = await this.runCalculation(req, false);
    res.status(200).json({ data: { current_accounts: accounts } });
  });

  private liquidateHandler = asyncHandler(async (req: Request, res: Response) => {
    const accounts = await this.runCalculation(req, true);
    res.status(200).json({ data: { current_accounts: accounts } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const account = await this.repository.getById(req.params.id);

    if (account.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La cuenta pertenece a otra organización');
    }

    const { liquidate, ...props } = pollaCurrentAccountUpdateSchema.parse(req.body);

    // Liquidar cierra el período: antes se trae al día con todo lo jugado.
    if (liquidate) {
      await this.repository.recalculateOpenPeriod(account.polla_organization_id, account.date);
    }

    let updated = await this.repository.recompute({
      currentAccountId: req.params.id,
      props,
      organizationId: account.polla_organization_id,
      calculateLeave: false,
      leaveInSubtotal: false,
    });

    // Una corrección cambia el saldo de los días siguientes.
    await this.repository.cascade(
      account.polla_organization_id,
      account.date,
      account.polla_user_id
    );

    if (liquidate) updated = await this.repository.markLiquidated(req.params.id);

    res.status(200).json({ data: { current_account: updated } });
  });

  private bulkUpdateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = pollaCurrentAccountBulkUpdateSchema.parse(req.body);
    const organizationId = resolveOrganizationId(user, req.body?.polla_organization_id);

    const updated = [];
    for (const item of payload.updates) {
      const { liquidate: _liquidate, ...props } = item.props;
      void _liquidate;
      updated.push(
        await this.repository.recompute({
          currentAccountId: item.polla_current_account_id,
          props,
          organizationId,
          calculateLeave: false,
          leaveInSubtotal: false,
        })
      );
    }

    await this.repository.cascade(organizationId, payload.date);

    res.status(200).json({ data: { current_accounts: updated } });
  });
}
