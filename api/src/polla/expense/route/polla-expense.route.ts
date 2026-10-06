import { Request, Response, Router } from 'express';
import { BadRequestError } from '@helper/errors';
import { POLLA_ADMIN_ROLES } from '@helper/polla/types/user.type';
import { newPollaOrgExpenseSchema } from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaExpenseRepository } from '../repository/polla-expense.repository';
import { resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Gastos de la organización para el ticket de cobros y pagos. Solo ADMIN+. */
export class PollaExpenseRouter {
  public router: Router;

  private repository = new PollaExpenseRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.use(requirePollaRole(...POLLA_ADMIN_ROLES));
    this.router.get('/', this.getByDateHandler);
    this.router.post('/', this.createHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  private getByDateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const date = req.query.date;

    if (typeof date !== 'string' || !ISO_DATE.test(date)) {
      throw new BadRequestError('Fecha inválida (YYYY-MM-DD)');
    }

    const expenses = await this.repository.getByDate(
      resolveOrganizationId(user, req.query.polla_organization_id),
      date,
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
      date: payload.date,
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
