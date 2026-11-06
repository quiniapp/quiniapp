import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { POLLA_API_ROLES } from '@helper/polla/config/access.config';
import { IPollaPrizeList } from '@helper/polla/types/game.type';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaPrizeRepository } from '../repository/polla-prize.repository';
import { PollaEditionRepository } from '../../edition/repository/polla-edition.repository';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Premios (R19): los tickets ganadores de cada edición, con grupo, pasador,
 * jugador o cliente, número de ticket y monto. Salen de la generación de
 * ganadores que ya existe; no pasan por la cuenta corriente (R18).
 */
export class PollaPrizeRouter {
  public router: Router;

  private repository = new PollaPrizeRepository();

  private editionRepository = new PollaEditionRepository();

  constructor() {
    this.router = Router();
    this.router.get('/', requirePollaRole(...POLLA_API_ROLES.readPrizes), this.getAllHandler);
  }

  /** `polla_edition_id` (obligatorio): los ganadores de esa edición y cuánto suman. */
  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const editionId = queryString(req.query.polla_edition_id);
    if (!editionId) throw new BadRequestError('Elegí la edición');

    const edition = await this.editionRepository.getById(editionId);
    if (edition.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La edición pertenece a otra organización');
    }

    const prizes = await this.repository.getAll({
      organizationId: user.polla_organization_id,
      editionId,
    });

    const list: IPollaPrizeList = {
      polla_edition_id: editionId,
      prizes,
      count: prizes.length,
      amount: prizes.reduce((acc, prize) => acc + prize.prize, 0),
    };

    res.status(200).json({ data: { prizes: list } });
  });
}
