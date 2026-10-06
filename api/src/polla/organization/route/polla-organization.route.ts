import { Request, Response, Router } from 'express';
import { NotFoundError } from '@helper/errors';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import {
  IPollaOrganizationEntityBack,
  IPollaOrganizationWithCapitalist,
} from '@helper/polla/types/catalog.type';
import { updatePollaOrganizationSchema } from '@helper/polla/schemas/catalog.schema';
import {
  newPollaOrganizationWithCapitalistSchema,
  resetPollaPasswordSchema,
} from '@helper/polla/schemas/user.schema';
import { hashPassword } from 'api/helper/password';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaCatalogRepository } from '../../catalog/repository/polla-catalog.repository';
import { PollaUserRepository } from '../../user/repository/polla-user.repository';
import { PollaAuthRepository } from '../../auth/repository/polla-auth.repository';
import { PollaOrganizationRepository } from '../repository/polla-organization.repository';
import { parsePagination } from '../../helper/pagination';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

/**
 * Organizaciones (una por capitalista). Como en QuiniApp, el OWNER las da de
 * alta junto con su capitalista y le puede blanquear la contraseña; el resto de
 * los roles solo lee la propia.
 */
export class PollaOrganizationRouter {
  public router: Router;

  private repository = new PollaCatalogRepository({
    table: 'polla_organizations',
    idColumn: 'polla_organization_id',
    orgScoped: false,
    orderBy: { column: 'name', ascending: true },
  });

  private organizationRepository = new PollaOrganizationRepository();

  private userRepository = new PollaUserRepository();

  private authRepository = new PollaAuthRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const ownerOnly = requirePollaRole(POLLA_USER_TYPE.OWNER);

    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.post('/', ownerOnly, this.createHandler);
    this.router.put('/:id', ownerOnly, this.updateHandler);
    this.router.delete('/:id', ownerOnly, this.deleteHandler);
    this.router.post('/:id/capitalist/reset-password', ownerOnly, this.resetCapitalistHandler);
  }

  /** El OWNER ve todas; el resto, solo la propia. */
  private scopeFor = (req: Request) => {
    const { user } = getPollaSession(req);
    return user.user_type === POLLA_USER_TYPE.OWNER
      ? ((req.query.polla_organization_id as string) ?? null)
      : user.polla_organization_id;
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const result = await this.repository.getAll(
      {
        organizationId: this.scopeFor(req),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      },
      pagination
    );

    const organizations = result.data as IPollaOrganizationEntityBack[];
    const capitalists = await this.userRepository.getCapitalists(
      organizations.map((org) => org.polla_organization_id)
    );

    const data: IPollaOrganizationWithCapitalist[] = organizations.map(
      ({ deleted_at: _deleted, ...org }) => {
        void _deleted;
        const capitalist = capitalists.find(
          (c) => c.polla_organization_id === org.polla_organization_id
        );
        return {
          ...org,
          capitalist: capitalist
            ? {
                polla_user_id: capitalist.polla_user_id,
                name: capitalist.name,
                last_name: capitalist.last_name,
                username: capitalist.username,
              }
            : null,
        };
      }
    );

    res.status(200).json({ data: { organizations: { ...result, data } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    if (user.user_type !== POLLA_USER_TYPE.OWNER && req.params.id !== user.polla_organization_id) {
      throw new NotFoundError('Organización');
    }

    const organization = await this.repository.getById(req.params.id);
    res.status(200).json({ data: { organizations: organization } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { organization, capitalist } = newPollaOrganizationWithCapitalistSchema.parse(req.body);
    const { password, ...capitalistData } = capitalist;

    const created = await this.organizationRepository.createWithCapitalist(organization.name, {
      ...capitalistData,
      password_hash: await hashPassword(password),
    });

    res.status(201).json({ data: { organizations: created.organization } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const payload = updatePollaOrganizationSchema.parse(req.body);
    const updated = await this.repository.update(req.params.id, payload);
    res.status(200).json({ data: { organizations: updated } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.repository.softDelete(req.params.id);
    res.status(200).json({ data: { success: true } });
  });

  /** Contraseña temporal para el capitalista: la tiene que cambiar al entrar. */
  private resetCapitalistHandler = asyncHandler(async (req: Request, res: Response) => {
    const { password } = resetPollaPasswordSchema.parse(req.body);

    await this.repository.getById(req.params.id);
    const [capitalist] = await this.userRepository.getCapitalists([req.params.id]);
    if (!capitalist) throw new NotFoundError('Capitalista de la organización');

    await this.authRepository.resetPassword(capitalist.polla_user_id, await hashPassword(password));

    res.status(200).json({ data: { success: true } });
  });
}
