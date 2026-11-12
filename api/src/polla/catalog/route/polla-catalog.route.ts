import { Request, RequestHandler, Response, Router } from 'express';
import { ZodSchema } from 'zod';
import { supabase } from '@database/db.connection';
import { ForbiddenError } from '@helper/errors';
import { POLLA_SUPER_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import {
  newPollaLotterySchema,
  updatePollaLotterySchema,
  newPollaScheduleSchema,
  updatePollaScheduleSchema,
  reorderPollaLotteriesSchema,
} from '@helper/polla/schemas/catalog.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaCatalogRepository, CatalogTableConfig } from '../repository/polla-catalog.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { throwIfPollaError } from '../../helper/polla-errors';
import { getLotteryPositions } from '../../helper/lottery-positions';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

type CatalogRow = Record<string, unknown>;

/* eslint-disable no-unused-vars */
interface CatalogRouterConfig extends CatalogTableConfig {
  resourceKey: string;
  newSchema: ZodSchema;
  updateSchema: ZodSchema;
  writeRoles: POLLA_USER_TYPE[];
  /** Datos que se suman a cada fila al leer (por ejemplo, la posición de las quinielas). */
  decorate?: (rows: CatalogRow[]) => Promise<CatalogRow[]>;
  /** Rutas propias del catálogo; se registran antes que las de `/:id`. */
  setupRoutes?: (router: Router, writeGuard: RequestHandler) => void;
}
/* eslint-enable no-unused-vars */

/**
 * Router genérico para los catálogos de Polla (quinielas y turnos): comparten
 * el mismo CRUD paginado y solo cambian tabla y schema. Los grupos tienen su
 * propio router (nacen con su admin).
 */
const createCatalogRouter = (config: CatalogRouterConfig): Router => {
  const router = Router();
  const repository = new PollaCatalogRepository(config);
  const writeGuard = requirePollaRole(...config.writeRoles);
  const decorate = config.decorate ?? (async (rows: CatalogRow[]) => rows);

  config.setupRoutes?.(router, writeGuard);

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

      res.status(200).json({
        data: {
          [config.resourceKey]: { ...result, data: await decorate(result.data as CatalogRow[]) },
        },
      });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      await assertScope(req, req.params.id);
      const item = await repository.getById(req.params.id);
      const [decorated] = await decorate([item as CatalogRow]);
      res.status(200).json({ data: { [config.resourceKey]: decorated } });
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

/**
 * R28: cada quiniela con su posición (1..N, el orden que define la
 * organización) y su etiqueta "1 - Nacional".
 */
const withPositions = async (rows: CatalogRow[]) => {
  const positions = await getLotteryPositions(
    rows.map((row) => row.polla_organization_id as string)
  );
  return rows.map((row) => {
    const position = positions.get(row.polla_lottery_id as string);
    return { ...row, position: position?.position, label: position?.label ?? row.name };
  });
};

/**
 * Quinielas y turnos son de toda la organización: el admin de grupo solo los
 * lee. Las quinielas salen en el orden de la organización y se reordenan con
 * `PUT /order` (dueño, capitalista y superadmin).
 */
export const pollaLotteryRouter = createCatalogRouter({
  table: 'polla_lotteries',
  idColumn: 'polla_lottery_id',
  orgScoped: true,
  orderBy: { column: 'order', ascending: true },
  resourceKey: 'lotteries',
  newSchema: newPollaLotterySchema,
  updateSchema: updatePollaLotterySchema,
  writeRoles: POLLA_SUPER_ROLES,
  decorate: withPositions,
  setupRoutes: (router, writeGuard) => {
    router.put(
      '/order',
      writeGuard,
      asyncHandler(async (req: Request, res: Response) => {
        const { user } = getPollaSession(req);
        const payload = reorderPollaLotteriesSchema.parse(req.body);
        const organizationId = resolveOrganizationId(user, payload.polla_organization_id);

        const { error } = await supabase.rpc('polla_reorder_lotteries', {
          p_organization_id: organizationId,
          p_lottery_ids: payload.polla_lottery_ids,
        });
        throwIfPollaError(error);

        res.status(200).json({ data: { success: true } });
      })
    );
  },
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
