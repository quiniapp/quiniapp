import { Request, Response, Router } from 'express';
import { PollaEditionController } from '../controller/polla-edition.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { USER_TYPE } from '@helper/types/user.type';
import { IPollaEditionEntityFront } from '@helper/types/polla-edition.type';
import {
  newPollaEditionSchema,
  updatePollaEditionSchema,
} from '@helper/schemas/polla-edition.schema';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { asyncHandler } from '../../middlewares/error.middleware';

export class PollaEditionRouter {
  public router: Router;
  private controller: PollaEditionController;

  constructor() {
    this.router = Router();
    this.controller = new PollaEditionController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getHandler);
    this.router.post('/', this.createHandler);
    this.router.put('/:id', this.updateHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  private assertNotCashier(req: Request) {
    if (req.user?.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError();
    }
  }

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    this.assertNotCashier(req);

    const parsed = newPollaEditionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
    }

    const edition = await this.controller.create(parsed.data, req.organization_id!);
    const response: APIResponse<IPollaEditionEntityFront> = { data: { edition } };
    res.status(200).json(response);
  });

  private getHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: polla_edition_id } = req.params;
    const edition = await this.controller.get({ polla_edition_id }, req.organization_id!);
    const response: APIResponse<IPollaEditionEntityFront> = { data: { edition } };
    res.status(200).json(response);
  });

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const editions = await this.controller.getAll(req.organization_id!, status);
    const response: APIResponse<IPollaEditionEntityFront[]> = { data: { edition: editions } };
    res.status(200).json(response);
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    this.assertNotCashier(req);
    const { id } = req.params;

    const parsed = updatePollaEditionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
    }

    const edition = await this.controller.update(id, parsed.data, req.organization_id!);
    const response: APIResponse<IPollaEditionEntityFront> = { data: { edition } };
    res.status(200).json(response);
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    this.assertNotCashier(req);
    const { id: polla_edition_id } = req.params;

    await this.controller.delete({ polla_edition_id }, req.organization_id!);
    res.status(200).json({ data: { deleted: true } });
  });
}
