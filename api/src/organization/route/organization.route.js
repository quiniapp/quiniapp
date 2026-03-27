import { Router } from 'express';
import { OrganizationController } from '../controller/organization.controller';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { DEFAULT_ORG_ID } from 'envs';
export class OrganizationRouter {
    constructor() {
        /**
         * POST /api/private/organization
         * Create a new organization with a CAPITALIST user
         * Only OWNER can create organizations
         * NOTE: New organizations do NOT inherit configuration
         */
        this.createHandler = async (req, res) => {
            const { organization, capitalist, superAdmin } = req.body;
            // Accept both "capitalist" and "superAdmin" for backwards compatibility
            const capitalistData = capitalist || superAdmin;
            const user = req.user;
            // Validar que se reciban los datos de la organización
            if (!organization || !organization.name || typeof organization.name !== 'string') {
                const response = {
                    error: { error: ERROR_TYPE.NAME_IS_REQUIRED, message: ERROR_MESSAGE.NAME_IS_REQUIRED },
                };
                res.status(400).json(response);
                return;
            }
            // Validar que se reciban los datos del capitalista
            if (!capitalistData) {
                const response = {
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
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const createdOrganization = await this.controller.create(organization, capitalistData);
                const response = {
                    data: { organization: createdOrganization },
                };
                res.status(201).json(response);
            }
            catch (error) {
                console.error(error);
                const response = {
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
        this.createSubOrganizationHandler = async (req, res) => {
            const { id: parentOrgId } = req.params;
            const { organization, superAdmin } = req.body;
            const user = req.user;
            // Validar que se reciban los datos de la organización
            if (!organization || !organization.name || typeof organization.name !== 'string') {
                const response = {
                    error: { error: ERROR_TYPE.NAME_IS_REQUIRED, message: ERROR_MESSAGE.NAME_IS_REQUIRED },
                };
                res.status(400).json(response);
                return;
            }
            // Solo OWNER y CAPITALIST pueden crear sub-organizaciones
            if (![USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user?.user.user_type)) {
                const response = {
                    error: {
                        error: ERROR_TYPE.FORBIDDEN,
                        message: 'Solo OWNER y CAPITALIST pueden crear grupos',
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const createdOrg = await this.controller.createSubOrganization(parentOrgId, organization, superAdmin // Optional - can be undefined
                );
                const response = {
                    data: { organization: createdOrg },
                };
                res.status(201).json(response);
            }
            catch (error) {
                console.error(error);
                const response = {
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
        this.getChildrenHandler = async (req, res) => {
            const { id: parentOrgId } = req.params;
            const user = req.user;
            // Solo OWNER y CAPITALIST pueden ver sub-organizaciones
            if (![USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user?.user.user_type)) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const children = await this.controller.getChildren(parentOrgId);
                const response = {
                    data: { organizations: children },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                };
                res.status(500).json(response);
            }
        };
        // Solo OWNER puede ver todas las organizaciones
        this.getAllHandler = async (req, res) => {
            const user = req.user;
            if (user?.user.user_type !== USER_TYPE.OWNER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const organizations = await this.controller.getAll();
                const response = {
                    data: { organizations },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                };
                res.status(500).json(response);
            }
        };
        // Usuarios pueden ver su propia organización
        this.getByIdHandler = async (req, res) => {
            const { id } = req.params;
            const user = req.user;
            // No se puede consultar la organización por defecto
            if (id === DEFAULT_ORG_ID) {
                const response = {
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
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const organization = await this.controller.get(id);
                const response = {
                    data: { organization },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                };
                res.status(500).json(response);
            }
        };
        // Solo OWNER puede actualizar organizaciones
        this.updateHandler = async (req, res) => {
            const { id } = req.params;
            const { name } = req.body;
            const user = req.user;
            if (user?.user.user_type !== USER_TYPE.OWNER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            // No se puede actualizar la organización por defecto
            if (id === DEFAULT_ORG_ID) {
                const response = {
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
                const response = {
                    data: { organization },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                };
                res.status(500).json(response);
            }
        };
        // Solo OWNER puede eliminar organizaciones
        this.deleteHandler = async (req, res) => {
            const { id } = req.params;
            const user = req.user;
            if (user?.user.user_type !== USER_TYPE.OWNER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            // No se puede eliminar la organización por defecto
            if (id === DEFAULT_ORG_ID) {
                const response = {
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
            }
            catch (error) {
                console.error(error);
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                };
                res.status(500).json(response);
            }
        };
        this.router = Router();
        this.controller = new OrganizationController();
        this.setupRoutes();
    }
    setupRoutes() {
        this.router.get('/', this.getAllHandler);
        this.router.get('/:id', this.getByIdHandler);
        this.router.get('/:id/children', this.getChildrenHandler); // Get sub-organizations
        this.router.post('/', this.createHandler);
        this.router.post('/:id/sub', this.createSubOrganizationHandler); // Create sub-organization
        this.router.put('/:id', this.updateHandler);
        this.router.delete('/:id', this.deleteHandler);
    }
}
