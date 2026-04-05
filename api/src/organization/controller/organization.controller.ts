import { OrganizationRepository } from '../repository/organization.repository';
import { parseOrganization } from '../helper/parseOrganization';
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { INewOrganizationEntity } from '@helper/request/organization.request';
import { INewUserEntity } from '@helper/request/user.request';
import { UserController } from '../../user/controller/user.controller';
import { USER_TYPE } from '@helper/types/user.type';

export class OrganizationController {
  private repository = new OrganizationRepository();
  private userController = new UserController();

  /**
   * Create a new organization with a CAPITALIST user
   * Used by OWNER to create new organizations
   * NOTE: New organizations do NOT inherit configuration - they start empty
   */
  create = async (
    organizationData: INewOrganizationEntity,
    capitalistData: INewUserEntity
  ): Promise<IOrganizationEntityFront> => {
    try {
      // Ensure the user is created as CAPITALIST
      capitalistData.user_type = USER_TYPE.CAPITALIST;

      // 1. Create the organization first
      const createdOrganization = await this.repository.create(organizationData);

      // 2. Create the CAPITALIST user with the organization_id
      try {
        await this.userController.create(capitalistData, createdOrganization.organization_id);
      } catch (userError) {
        // If user creation fails, delete the organization (rollback)
        await this.repository.delete(createdOrganization.organization_id);
        console.error('Capitalist creation error, organization rolled back:', userError);
        throw new Error(
          'Error al crear el Capitalista: ' +
            (userError instanceof Error ? userError.message : 'Unknown error')
        );
      }

      return parseOrganization(createdOrganization);
    } catch (error) {
      console.error('Organization creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  /**
   * Create a sub-organization (group) under a parent organization
   * Used by CAPITALIST to create groups
   * NOTE: Sub-organizations INHERIT configuration from parent (lotteries, schedules, etc.)
   */
  createSubOrganization = async (
    parentOrgId: string,
    organizationData: { name: string },
    superAdminData?: INewUserEntity
  ): Promise<IOrganizationEntityFront> => {
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
      } catch (setupError) {
        // If setup fails, delete the sub-organization (rollback)
        await this.repository.delete(createdOrg.organization_id);
        console.error('Sub-organization setup error, rolled back:', setupError);
        throw new Error(
          'Error al configurar el grupo: ' +
            (setupError instanceof Error ? setupError.message : 'Unknown error')
        );
      }

      return parseOrganization(createdOrg);
    } catch (error) {
      console.error('Sub-organization creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  /**
   * Get direct children (sub-organizations) of an organization
   */
  getChildren = async (parentOrgId: string): Promise<IOrganizationEntityFront[]> => {
    try {
      const children = await this.repository.getChildren(parentOrgId);
      return children.map((org) => parseOrganization(org));
    } catch (error) {
      console.error('Organization getChildren error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  get = async (organization_id: string): Promise<IOrganizationEntityFront> => {
    try {
      const org = await this.repository.getById(organization_id);
      return parseOrganization(org);
    } catch (error) {
      console.error('Organization get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (): Promise<IOrganizationEntityFront[]> => {
    try {
      const orgs = await this.repository.getAll();
      return orgs.map((org) => parseOrganization(org));
    } catch (error) {
      console.error('Organization getAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (
    id: string,
    props: Partial<{ name: string }>
  ): Promise<IOrganizationEntityFront> => {
    try {
      const org = await this.repository.update(id, props);
      return parseOrganization(org);
    } catch (error) {
      console.error('Organization update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (organization_id: string): Promise<void> => {
    try {
      await this.repository.delete(organization_id);
    } catch (error) {
      console.error('Organization delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
