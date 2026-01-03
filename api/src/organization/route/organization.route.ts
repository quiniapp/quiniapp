import { Request, Response, Router } from 'express';
import { OrganizationController } from '../controller/organization.controller';
import { RequestHandler } from 'express-serve-static-core';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { DEFAULT_ORG_ID } from 'envs';

export class OrganizationRouter {
  public router: Router;
  private controller: OrganizationController;

  constructor() {
    this.router = Router();
    this.controller = new OrganizationController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.get('/:id/children', this.getChildrenHandler); // Get sub-organizations
    this.router.post('/', this.createHandler);
    this.router.post('/:id/sub', this.createSubOrganizationHandler); // Create sub-organization
    this.router.put('/:id', this.updateHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  /**
   * POST /api/private/organization
   * Create a new organization with a CAPITALIST user
   * Only OWNER can create organizations
   * NOTE: New organizations do NOT inherit configuration
   */
  private createHandler: RequestHandler = async (req: Request, res: Response) => {
    const { organization, capitalist, superAdmin } = req.body;
    // Accept both "capitalist" and "superAdmin" for backwards compatibility
    const capitalistData = capitalist || superAdmin;
    const user = req.user;

    // Validar que se reciban los datos de la organización
    if (!organization || !organization.name || typeof organization.name !== 'string') {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.NAME_IS_REQUIRED, message: ERROR_MESSAGE.NAME_IS_REQUIRED },
      };
      res.status(400).json(response);
      return;
    }

    // Validar que se reciban los datos del capitalista
    if (!capitalistData) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: 'Los datos del Capitalista son requeridos',
        },
      };
      res.status(400).json(response);
      return;
    }

    // Solo OWNER puede crear organizaciones
    if (user?.user.user_type !== USER_TYPE.OWNER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const createdOrganization = await this.controller.create(organization, capitalistData);
      const response: APIResponse<IOrganizationEntityFront> = {
        data: { organization: createdOrganization },
      };
      res.status(201).json(response);
    } catch (error) {
      console.error(error);
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/private/organization/:id/sub
   * Create a sub-organization (group) under a parent organization
   * Only OWNER and CAPITALIST can create sub-organizations
   * NOTE: Sub-organizations INHERIT configuration from parent
   */
  private createSubOrganizationHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id: parentOrgId } = req.params;
    const { organization, superAdmin } = req.body;
    const user = req.user;

    // Validar que se reciban los datos de la organización
    if (!organization || !organization.name || typeof organization.name !== 'string') {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.NAME_IS_REQUIRED, message: ERROR_MESSAGE.NAME_IS_REQUIRED },
      };
      res.status(400).json(response);
      return;
    }

    // Solo OWNER y CAPITALIST pueden crear sub-organizaciones
    if (![USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user?.user.user_type as USER_TYPE)) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: 'Solo OWNER y CAPITALIST pueden crear grupos',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const createdOrg = await this.controller.createSubOrganization(
        parentOrgId,
        organization,
        superAdmin // Optional - can be undefined
      );
      const response: APIResponse<IOrganizationEntityFront> = {
        data: { organization: createdOrg },
      };
      res.status(201).json(response);
    } catch (error) {
      console.error(error);
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/private/organization/:id/children
   * Get direct sub-organizations of an organization
   * OWNER can see all, CAPITALIST can see their org's children
   */
  private getChildrenHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id: parentOrgId } = req.params;
    const user = req.user;

    // Solo OWNER y CAPITALIST pueden ver sub-organizaciones
    if (![USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user?.user.user_type as USER_TYPE)) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const children = await this.controller.getChildren(parentOrgId);
      const response: APIResponse<IOrganizationEntityFront[]> = {
        data: { organizations: children },
      };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  };

  // Solo OWNER puede ver todas las organizaciones
  private getAllHandler: RequestHandler = async (req: Request, res: Response) => {
    const user = req.user;

    if (user?.user.user_type !== USER_TYPE.OWNER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const organizations = await this.controller.getAll();
      const response: APIResponse<IOrganizationEntityFront[]> = {
        data: { organizations },
      };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  };

  // Usuarios pueden ver su propia organización
  private getByIdHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;

    // No se puede consultar la organización por defecto
    if (id === DEFAULT_ORG_ID) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: 'No se puede consultar la organización por defecto',
        },
      };
      res.status(403).json(response);
      return;
    }

    // Si no es OWNER, solo puede ver su propia organización
    if (user?.user.user_type !== USER_TYPE.OWNER && user?.organization_id !== id) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const organization = await this.controller.get(id);
      const response: APIResponse<IOrganizationEntityFront> = {
        data: { organization },
      };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  };

  // Solo OWNER puede actualizar organizaciones
  private updateHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name } = req.body;
    const user = req.user;

    if (user?.user.user_type !== USER_TYPE.OWNER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    // No se puede actualizar la organización por defecto
    if (id === DEFAULT_ORG_ID) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: 'No se puede actualizar la organización por defecto',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const organization = await this.controller.update(id, { name });
      const response: APIResponse<IOrganizationEntityFront> = {
        data: { organization },
      };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  };

  // Solo OWNER puede eliminar organizaciones
  private deleteHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;
    if (user?.user.user_type !== USER_TYPE.OWNER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    // No se puede eliminar la organización por defecto
    if (id === DEFAULT_ORG_ID) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: 'No se puede eliminar la organización por defecto',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      await this.controller.delete(id);
      res.status(200).json({ data: { deleted: true } });
    } catch (error) {
      console.error(error);
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  };
}
