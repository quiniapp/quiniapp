import { Request, Response, Router } from 'express';
import { ZodSchema } from 'zod';
import { ForbiddenError } from '@helper/errors';
import { POLLA_SUPER_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import {
  newPollaLotterySchema,
  updatePollaLotterySchema,
  newPollaScheduleSchema,
  updatePollaScheduleSchema,
} from '@helper/polla/schemas/catalog.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaCatalogRepository, CatalogTableConfig } from '../repository/polla-catalog.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

interface CatalogRouterConfig extends CatalogTableConfig {
  resourceKey: string;
  newSchema: ZodSchema;
  updateSchema: ZodSchema;
  writeRoles: POLLA_USER_TYPE[];
}

/**
 * Router genérico para los catálogos de Polla (quinielas y turnos): comparten
 * el mismo CRUD paginado y solo cambian tabla y schema. Los grupos tienen su
 * propio router (nacen con su admin).
 */
const createCatalogRouter = (config: CatalogRouterConfig): Router => {
  const router = Router();
  const repository = new PollaCatalogRepository(config);
  const writeGuard = requirePollaRole(...config.writeRoles);

  const assertScope = async (req: Request, id: string) => {
    const { user } = getPollaSession(req);
    const belongs = await repository.assertBelongsToOrganization(id, user.polla_organization_id);
    if (!belongs) {
      throw new ForbiddenError('El registro pertenece a otra organización');
    }
  };

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const { user } = getPollaSession(req);
      const pagination = parsePagination(req.query as Record<string, unknown>);

      const organizationId = config.orgScoped
        ? resolveOptionalOrganizationId(user, req.query.polla_organization_id)
        : // Sobre polla_organizations: el OWNER ve todas, el resto solo la suya.
          user.user_type === POLLA_USER_TYPE.OWNER
          ? ((req.query.polla_organization_id as string) ?? null)
          : user.polla_organization_id;

      const result = await repository.getAll(
        {
          organizationId,
          active: req.query.active === undefined ? undefined : req.query.active === 'true',
          search: typeof req.query.search === 'string' ? req.query.search : undefined,
        },
        pagination
      );

      res.status(200).json({ data: { [config.resourceKey]: result } });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      await assertScope(req, req.params.id);
      const item = await repository.getById(req.params.id);
      res.status(200).json({ data: { [config.resourceKey]: item } });
    })
  );

  router.post(
    '/',
    writeGuard,
    asyncHandler(async (req: Request, res: Response) => {
      const { user } = getPollaSession(req);
      const payload = config.newSchema.parse(req.body) as Record<string, unknown>;

      if (config.orgScoped) {
        payload.polla_organization_id = resolveOrganizationId(user, payload.polla_organization_id);
      } else {
        delete payload.polla_organization_id;
      }

      const created = await repository.create(payload);
      res.status(201).json({ data: { [config.resourceKey]: created } });
    })
  );

  router.put(
    '/:id',
    writeGuard,
    asyncHandler(async (req: Request, res: Response) => {
      if (config.orgScoped) await assertScope(req, req.params.id);
      const payload = config.updateSchema.parse(req.body) as Record<string, unknown>;
      const updated = await repository.update(req.params.id, payload);
      res.status(200).json({ data: { [config.resourceKey]: updated } });
    })
  );

  router.delete(
    '/:id',
    writeGuard,
    asyncHandler(async (req: Request, res: Response) => {
      if (config.orgScoped) await assertScope(req, req.params.id);
      await repository.softDelete(req.params.id);
      res.status(200).json({ data: { success: true } });
    })
  );

  return router;
};

/** Quinielas y turnos son de toda la organización: el admin de grupo solo los lee. */
export const pollaLotteryRouter = createCatalogRouter({
  table: 'polla_lotteries',
  idColumn: 'polla_lottery_id',
  orgScoped: true,
  orderBy: { column: 'order', ascending: true },
  resourceKey: 'lotteries',
  newSchema: newPollaLotterySchema,
  updateSchema: updatePollaLotterySchema,
  writeRoles: POLLA_SUPER_ROLES,
});

export const pollaScheduleRouter = createCatalogRouter({
  table: 'polla_schedules',
  idColumn: 'polla_schedule_id',
  orgScoped: true,
  orderBy: { column: 'time', ascending: true },
  resourceKey: 'schedules',
  newSchema: newPollaScheduleSchema,
  updateSchema: updatePollaScheduleSchema,
  writeRoles: POLLA_SUPER_ROLES,
});
