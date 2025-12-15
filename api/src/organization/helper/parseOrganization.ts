import { IOrganizationEntityBack, IOrganizationEntityFront } from '@helper/types/organization.type';

export const parseOrganization = (org: IOrganizationEntityBack): IOrganizationEntityFront => {
  return {
    organization_id: org.organization_id,
    name: org.name,
  };
};
