import { OrganizationRepository } from '../repository/organization.repository';
import { parseOrganization } from '../helper/parseOrganization';
import { IOrganizationEntityFront } from '@helper/types/organization.type';

export class OrganizationController {
  private repository = new OrganizationRepository();

  create = async (props: { name: string }): Promise<IOrganizationEntityFront> => {
    try {
      const result = await this.repository.create(props);
      return parseOrganization(result);
    } catch (error) {
      console.error('Organization creation error:', error);
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
