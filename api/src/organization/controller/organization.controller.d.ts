import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { INewOrganizationEntity } from '@helper/request/organization.request';
import { INewUserEntity } from '@helper/request/user.request';
export declare class OrganizationController {
  private repository;
  private userController;
  /**
   * Create a new organization with a CAPITALIST user
   * Used by OWNER to create new organizations
   * NOTE: New organizations do NOT inherit configuration - they start empty
   */
  create: (
    organizationData: INewOrganizationEntity,
    capitalistData: INewUserEntity
  ) => Promise<IOrganizationEntityFront>;
  /**
   * Create a sub-organization (group) under a parent organization
   * Used by CAPITALIST to create groups
   * NOTE: Sub-organizations INHERIT configuration from parent (lotteries, schedules, etc.)
   */
  createSubOrganization: (
    parentOrgId: string,
    organizationData: {
      name: string;
    },
    superAdminData?: INewUserEntity
  ) => Promise<IOrganizationEntityFront>;
  /**
   * Get direct children (sub-organizations) of an organization
   */
  getChildren: (parentOrgId: string) => Promise<IOrganizationEntityFront[]>;
  get: (organization_id: string) => Promise<IOrganizationEntityFront>;
  getAll: () => Promise<IOrganizationEntityFront[]>;
  update: (
    id: string,
    props: Partial<{
      name: string;
    }>
  ) => Promise<IOrganizationEntityFront>;
  delete: (organization_id: string) => Promise<void>;
}
