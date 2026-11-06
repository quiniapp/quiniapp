import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { POLLA_API_ROLES } from '@helper/polla/config/access.config';
import { IPollaPrizeList } from '@helper/polla/types/game.type';
import { POLLA_SUPER_ROLES } from '@helper/polla/types/user.type';
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
    // R20: tildan pagado el dueño, el capitalista y el superadmin.
    this.router.post('/:betId/paid', requirePollaRole(...POLLA_SUPER_ROLES), this.markPaidHandler);
  }

  /**
   * `polla_edition_id` (obligatorio): los ganadores de esa edición. `paid`
   * (`true` | `false`) lista solo los pagados o solo los pendientes; los
   * totales son siempre de toda la edición.
   */
  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const editionId = queryString(req.query.polla_edition_id);
    if (!editionId) throw new BadRequestError('Elegí la edición');

    const edition = await this.editionRepository.getById(editionId);
    if (edition.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La edición pertenece a otra organización');
    }

    const paid = queryString(req.query.paid);
    if (paid && paid !== 'true' && paid !== 'false') {
      throw new BadRequestError('Filtro de pagados inválido');
    }

    const all = await this.repository.getAll({
      organizationId: user.polla_organization_id,
      editionId,
    });
    const isPaid = (prize: { prize_paid_at: string | null }) => prize.prize_paid_at !== null;
    const sum = (list: typeof all) => list.reduce((acc, prize) => acc + prize.prize, 0);
    const paidOnes = all.filter(isPaid);

    const list: IPollaPrizeList = {
      polla_edition_id: editionId,
      prizes: paid ? all.filter((prize) => isPaid(prize) === (paid === 'true')) : all,
      count: all.length,
      amount: sum(all),
      paid_count: paidOnes.length,
      paid_amount: sum(paidOnes),
      pending_amount: sum(all) - sum(paidOnes),
    };

    res.status(200).json({ data: { prizes: list } });
  });

  /** Tilda el premio como pagado (R20). Guarda quién y cuándo; no se destilda. */
  private markPaidHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const result = await this.repository.markPaid(user.polla_user_id, req.params.betId);
    res.status(200).json({ data: { result } });
  });
}
