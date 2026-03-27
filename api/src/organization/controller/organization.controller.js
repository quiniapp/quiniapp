import { OrganizationRepository } from '../repository/organization.repository';
import { parseOrganization } from '../helper/parseOrganization';
import { UserController } from '../../user/controller/user.controller';
import { USER_TYPE } from '@helper/types/user.type';
export class OrganizationController {
    constructor() {
        this.repository = new OrganizationRepository();
        this.userController = new UserController();
        /**
         * Create a new organization with a CAPITALIST user
         * Used by OWNER to create new organizations
         * NOTE: New organizations do NOT inherit configuration - they start empty
         */
        this.create = async (organizationData, capitalistData) => {
            try {
                // Ensure the user is created as CAPITALIST
                capitalistData.user_type = USER_TYPE.CAPITALIST;
                // 1. Create the organization first
                const createdOrganization = await this.repository.create(organizationData);
                // 2. Create the CAPITALIST user with the organization_id
                try {
                    await this.userController.create(capitalistData, createdOrganization.organization_id);
                }
                catch (userError) {
                    // If user creation fails, delete the organization (rollback)
                    await this.repository.delete(createdOrganization.organization_id);
                    console.error('Capitalist creation error, organization rolled back:', userError);
                    throw new Error('Error al crear el Capitalista: ' +
                        (userError instanceof Error ? userError.message : 'Unknown error'));
                }
                return parseOrganization(createdOrganization);
            }
            catch (error) {
                console.error('Organization creation error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        /**
         * Create a sub-organization (group) under a parent organization
         * Used by CAPITALIST to create groups
         * NOTE: Sub-organizations INHERIT configuration from parent (lotteries, schedules, etc.)
         */
        this.createSubOrganization = async (parentOrgId, organizationData, superAdminData) => {
            try {
                // 1. Create the sub-organization
                const createdOrg = await this.repository.createSubOrganization({
                    name: organizationData.name,
                    parent_organization_id: parentOrgId,
                });
                try {
                    // 2. Inherit configuration from parent (lotteries, schedules, schedule_lotteries)
                    await this.repository.inheritConfiguration(parentOrgId, createdOrg.organization_id);
                    // 3. Create SUPERADMIN if provided
                    if (superAdminData) {
                        superAdminData.user_type = USER_TYPE.SUPERADMIN;
                        await this.userController.create(superAdminData, createdOrg.organization_id);
                    }
                }
                catch (setupError) {
                    // If setup fails, delete the sub-organization (rollback)
                    await this.repository.delete(createdOrg.organization_id);
                    console.error('Sub-organization setup error, rolled back:', setupError);
                    throw new Error('Error al configurar el grupo: ' +
                        (setupError instanceof Error ? setupError.message : 'Unknown error'));
                }
                return parseOrganization(createdOrg);
            }
            catch (error) {
                console.error('Sub-organization creation error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        /**
         * Get direct children (sub-organizations) of an organization
         */
        this.getChildren = async (parentOrgId) => {
            try {
                const children = await this.repository.getChildren(parentOrgId);
                return children.map((org) => parseOrganization(org));
            }
            catch (error) {
                console.error('Organization getChildren error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.get = async (organization_id) => {
            try {
                const org = await this.repository.getById(organization_id);
                return parseOrganization(org);
            }
            catch (error) {
                console.error('Organization get error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getAll = async () => {
            try {
                const orgs = await this.repository.getAll();
                return orgs.map((org) => parseOrganization(org));
            }
            catch (error) {
                console.error('Organization getAll error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.update = async (id, props) => {
            try {
                const org = await this.repository.update(id, props);
                return parseOrganization(org);
            }
            catch (error) {
                console.error('Organization update error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.delete = async (organization_id) => {
            try {
                await this.repository.delete(organization_id);
            }
            catch (error) {
                console.error('Organization delete error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
    }
}
