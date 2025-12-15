import { Request, Response, Router } from 'express';
import { OrganizationController } from '../controller/organization.controller';
import { RequestHandler } from 'express-serve-static-core';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { IOrganizationEntityFront } from '@helper/types/organization.type';

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
    this.router.post('/', this.createHandler);
    this.router.put('/:id', this.updateHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  // Solo OWNER puede crear organizaciones
  private createHandler: RequestHandler = async (req: Request, res: Response) => {
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

    // Validar que se reciban los datos del super admin
    if (!superAdmin) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: 'Los datos del Super Admin son requeridos',
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
      const createdOrganization = await this.controller.create(organization, superAdmin);
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
