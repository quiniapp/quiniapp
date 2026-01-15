import { IOrganizationEntityBack, IOrganizationEntityFront } from '@helper/types/organization.type';

export const parseOrganization = (org: IOrganizationEntityBack): IOrganizationEntityFront => {
  return {
    name: org.name,
    organization_id: org.organization_id,
  };
};
