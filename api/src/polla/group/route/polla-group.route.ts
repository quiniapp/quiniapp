import { Request, Response, Router } from 'express';
import { BadRequestError, ConflictError, ForbiddenError } from '@helper/errors';
import { POLLA_SUPER_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { IPollaGroupEntityBack, IPollaGroupWithAdmin } from '@helper/polla/types/catalog.type';
import { updatePollaGroupSchema } from '@helper/polla/schemas/catalog.schema';
import {
  assignPollaGroupAdminSchema,
  newPollaGroupWithAdminSchema,
} from '@helper/polla/schemas/user.schema';
import { hashPassword } from 'api/helper/password';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaCatalogRepository } from '../../catalog/repository/polla-catalog.repository';
import { PollaUserRepository } from '../../user/repository/polla-user.repository';
import { PollaGroupRepository } from '../repository/polla-group.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

/**
 * Grupos: cada uno nace con su admin, que opera solo adentro (jugadas,
 * pasadores y jugadores del grupo). Los arman superadmin, capitalista y dueño.
 * Todos los leen (filtros de jugadas); el admin del grupo se ve solo desde
 * superadmin+.
 */
export class PollaGroupRouter {
  public router: Router;

  private repository = new PollaCatalogRepository({
    table: 'polla_groups',
    idColumn: 'polla_group_id',
    orgScoped: true,
    orderBy: { column: 'name', ascending: true },
  });

  private groupRepository = new PollaGroupRepository();

  private userRepository = new PollaUserRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const superOnly = requirePollaRole(...POLLA_SUPER_ROLES);

    this.router.get('/', this.getAllHandler);
    this.router.get('/admins-without-group', superOnly, this.adminsWithoutGroupHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.post('/', superOnly, this.createHandler);
    this.router.put('/:id', superOnly, this.updateHandler);
    this.router.post('/:id/admin', superOnly, this.assignAdminHandler);
    this.router.delete('/:id', superOnly, this.deleteHandler);
  }

  private assertScope = async (req: Request, id: string) => {
    const { user } = getPollaSession(req);
    const belongs = await this.repository.assertBelongsToOrganization(
      id,
      user.polla_organization_id
    );
    if (!belongs) {
      throw new ForbiddenError('El grupo pertenece a otra organización');
    }
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const result = await this.repository.getAll(
      {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      },
      pagination
    );

    const groups = result.data as IPollaGroupEntityBack[];
    const withAdmin = POLLA_SUPER_ROLES.includes(user.user_type);
    const admins = withAdmin
      ? await this.userRepository.getGroupAdmins(groups.map((group) => group.polla_group_id))
      : [];

    const data: IPollaGroupWithAdmin[] = groups.map(({ deleted_at: _deleted, ...group }) => {
      void _deleted;
      const admin = admins.find((a) => a.polla_group_id === group.polla_group_id);
      return {
        ...group,
        admin: admin
          ? {
              polla_user_id: admin.polla_user_id,
              name: admin.name,
              last_name: admin.last_name,
              username: admin.username,
            }
          : null,
      };
    });

    res.status(200).json({ data: { groups: { ...result, data } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.assertScope(req, req.params.id);
    const group = await this.repository.getById(req.params.id);
    res.status(200).json({ data: { groups: group } });
  });

  private adminsWithoutGroupHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const admins = await this.userRepository.getAdminsWithoutGroup(user.polla_organization_id);
    res.status(200).json({ data: { admins } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const { group, admin } = newPollaGroupWithAdminSchema.parse(req.body);
    const { password, ...adminData } = admin;

    const created = await this.groupRepository.createWithAdmin(
      resolveOrganizationId(user, req.body?.polla_organization_id),
      group.name,
      { ...adminData, password_hash: await hashPassword(password) }
    );

    res.status(201).json({ data: { groups: created.group } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.assertScope(req, req.params.id);
    const payload = updatePollaGroupSchema.parse(req.body);
    const updated = await this.repository.update(req.params.id, payload);
    res.status(200).json({ data: { groups: updated } });
  });

  /**
   * A un grupo sin admin (del modelo anterior), uno de los admins sin grupo o
   * uno nuevo. El índice único de la base garantiza uno por grupo.
   */
  private assignAdminHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertScope(req, req.params.id);
    const { polla_user_id, admin: newAdmin } = assignPollaGroupAdminSchema.parse(req.body);

    const [current] = await this.userRepository.getGroupAdmins([req.params.id]);
    if (current) throw new ConflictError('Ese grupo ya tiene un admin');

    if (newAdmin) {
      const { password, ...adminData } = newAdmin;
      await this.userRepository.create({
        ...adminData,
        user_type: POLLA_USER_TYPE.ADMIN,
        polla_organization_id: user.polla_organization_id,
        polla_group_id: req.params.id,
        password_hash: await hashPassword(password),
        password_changed_at: new Date().toISOString(),
      });
      res.status(201).json({ data: { success: true } });
      return;
    }

    const admin = await this.userRepository.getById(polla_user_id!);
    if (
      admin.polla_organization_id !== user.polla_organization_id ||
      admin.user_type !== POLLA_USER_TYPE.ADMIN
    ) {
      throw new BadRequestError('Elegí un administrador de tu organización');
    }
    if (admin.polla_group_id) {
      throw new ConflictError('Ese administrador ya tiene grupo');
    }

    await this.userRepository.update(polla_user_id!, { polla_group_id: req.params.id });
    res.status(200).json({ data: { success: true } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertScope(req, req.params.id);
    const result = await this.groupRepository.remove(req.params.id, user.polla_user_id);
    res.status(200).json({ data: { success: true, deleted_users: result.deleted_users } });
  });
}
