import { IOrganizationEntityBack } from '@helper/types/organization.type';
export declare class OrganizationRepository {
  getById(id: string): Promise<IOrganizationEntityBack>;
  getAll(): Promise<IOrganizationEntityBack[]>;
  /**
   * Get direct children of an organization (sub-organizations/groups)
   */
  getChildren(parentOrgId: string): Promise<IOrganizationEntityBack[]>;
  /**
   * Get all descendant organization IDs (recursive)
   */
  getDescendants(orgId: string): Promise<string[]>;
  create(payload: { name: string }): Promise<IOrganizationEntityBack>;
  /**
   * Create a sub-organization (group) under a parent organization
   */
  createSubOrganization(payload: {
    name: string;
    parent_organization_id: string;
  }): Promise<IOrganizationEntityBack>;
  /**
   * Inherit configuration from parent organization to new sub-organization
   * Copies lotteries, schedules, and schedule_lotteries
   */
  inheritConfiguration(parentOrgId: string, newOrgId: string): Promise<void>;
  update(
    id: string,
    payload: Partial<{
      name: string;
    }>
  ): Promise<IOrganizationEntityBack>;
  delete(id: string): Promise<void>;
}
