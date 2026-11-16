import { Request, Response, Router } from 'express';
import { BadRequestError } from '@helper/errors';
import { POLLA_ACCOUNT_ROLES } from '@helper/polla/types/user.type';
import { newPollaOrgExpenseSchema } from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaExpenseRepository } from '../repository/polla-expense.repository';
import { pollaToday } from '../../helper/date';
import { resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gastos de la organización para el ticket de cobros y pagos. Son parte de la
 * cuenta corriente: solo dueño, capitalista y superadmin (`POLLA_ACCOUNT_ROLES`).
 */
export class PollaExpenseRouter {
  public router: Router;

  private repository = new PollaExpenseRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.use(requirePollaRole(...POLLA_ACCOUNT_ROLES));
    this.router.get('/', this.getAllHandler);
    this.router.post('/', this.createHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  /** Por edición (`polla_edition_id`, tiene prioridad) o, para el historial, por `date`. */
  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const { polla_edition_id: editionId, date } = req.query;

    let scope: { editionId: string } | { date: string };
    if (typeof editionId === 'string' && editionId) {
      if (!UUID.test(editionId)) throw new BadRequestError('Edición inválida');
      scope = { editionId };
    } else if (typeof date === 'string' && ISO_DATE.test(date)) {
      scope = { date };
    } else {
      throw new BadRequestError('Falta la edición o la fecha (YYYY-MM-DD)');
    }

    const expenses = await this.repository.getAll(
      resolveOrganizationId(user, req.query.polla_organization_id),
      scope,
      typeof req.query.polla_group_id === 'string' && req.query.polla_group_id
        ? req.query.polla_group_id
        : null
    );

    res.status(200).json({ data: { expenses } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = newPollaOrgExpenseSchema.parse(req.body);

    const expense = await this.repository.create({
      polla_organization_id: resolveOrganizationId(user, payload.polla_organization_id),
      polla_group_id: payload.polla_group_id ?? null,
      polla_edition_id: payload.polla_edition_id,
      date: pollaToday(),
      name: payload.name,
      amount: payload.amount,
      created_by: user.polla_user_id,
    });

    res.status(201).json({ data: { expense } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.repository.remove(
      req.params.id,
      resolveOrganizationId(user, req.query.polla_organization_id)
    );
    res.status(200).json({ data: { success: true } });
  });
}
