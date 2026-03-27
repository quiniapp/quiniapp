import { IOrganizationEntityBack } from '../types/organization.type';
export type INewOrganizationEntity = Pick<IOrganizationEntityBack, 'name'>;
export type IUpdateOrganizationEntity = Partial<Pick<IOrganizationEntityBack, 'name'>>;
export type IDeleteOrganizationEntity = Pick<IOrganizationEntityBack, 'organization_id'>;
export type IGetOrganizationEntity = Pick<IOrganizationEntityBack, 'organization_id'>;
