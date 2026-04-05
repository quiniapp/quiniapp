export interface IOrganizationEntityBack {
  organization_id: string;
  name: string;
  parent_organization_id: string | null; // NULL = root org, non-NULL = sub-org/group
  created_at: string | Date;
  edited_at: string | Date;
  deleted_at: string | null | Date;
}

export type IOrganizationEntityFront = Omit<
  IOrganizationEntityBack,
  'created_at' | 'deleted_at' | 'edited_at'
>;
