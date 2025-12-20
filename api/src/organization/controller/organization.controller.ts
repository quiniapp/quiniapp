import { OrganizationRepository } from '../repository/organization.repository';
import { parseOrganization } from '../helper/parseOrganization';
import { IOrganizationEntityFront } from '@helper/types/organization.type';
import { INewOrganizationEntity } from '@helper/request/organization.request';
import { INewUserEntity } from '@helper/request/user.request';
import { UserController } from '../../user/controller/user.controller';

export class OrganizationController {
  private repository = new OrganizationRepository();
  private userController = new UserController();

  create = async (
    organizationData: INewOrganizationEntity,
    superAdminData: INewUserEntity
  ): Promise<IOrganizationEntityFront> => {
    try {
      // 1. Crear la organización primero
      const createdOrganization = await this.repository.create(organizationData);

      // 2. Crear el usuario super admin con el organization_id de la organización creada
      try {
        await this.userController.create(superAdminData, createdOrganization.organization_id);
      } catch (userError) {
        // Si falla la creación del usuario, eliminar la organización creada
        await this.repository.delete(createdOrganization.organization_id);
        console.error('Super admin creation error, organization rolled back:', userError);
        throw new Error(
          'Error al crear el Super Admin: ' +
            (userError instanceof Error ? userError.message : 'Unknown error')
        );
      }

      return parseOrganization(createdOrganization);
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
