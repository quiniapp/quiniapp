import { Request, RequestHandler, Response, Router } from 'express';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { OrgExpenseController } from '../controller/org-expense.controller';

export class OrgExpenseRouter {
  public router: Router;
  private controller: OrgExpenseController;

  constructor() {
    this.router = Router();
    this.controller = new OrgExpenseController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getByDateHandler);
    this.router.post('/', this.createHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  private getByDateHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, group_id } = req.query;

    if (!user?.user || !date || typeof date !== 'string') {
      res
        .status(400)
        .json({ error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST } });
      return;
    }

    if (user.user.user_type === USER_TYPE.CASHIER) {
      res.status(403).json({ error: { error: ERROR_TYPE.AUTH_ERROR, message: 'Access denied' } });
      return;
    }

    try {
      const expenses = await this.controller.getByOrgAndDate(
        req.organization_id!,
        date,
        typeof group_id === 'string' ? group_id : null
      );
      res.status(200).json({ data: { expenses } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: { error: ERROR_TYPE.AUTH_ERROR, message } });
    }
  };

  private createHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, name, amount, group_id } = req.body;

    if (!user?.user || !date || !name || amount === undefined) {
      res
        .status(400)
        .json({ error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST } });
      return;
    }

    if (user.user.user_type === USER_TYPE.CASHIER) {
      res.status(403).json({ error: { error: ERROR_TYPE.AUTH_ERROR, message: 'Access denied' } });
      return;
    }

    try {
      const expense = await this.controller.create(
        req.organization_id!,
        date,
        name,
        Number(amount),
        group_id ?? null
      );
      res.status(201).json({ data: { expense } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: { error: ERROR_TYPE.AUTH_ERROR, message } });
    }
  };

  private deleteHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id } = req.params;

    if (!user?.user) {
      res
        .status(400)
        .json({ error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST } });
      return;
    }

    if (user.user.user_type === USER_TYPE.CASHIER) {
      res.status(403).json({ error: { error: ERROR_TYPE.AUTH_ERROR, message: 'Access denied' } });
      return;
    }

    try {
      await this.controller.delete(id, req.organization_id!);
      res.status(200).json({ data: { ok: true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: { error: ERROR_TYPE.AUTH_ERROR, message } });
    }
  };
}
