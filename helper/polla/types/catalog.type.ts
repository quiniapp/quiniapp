/** Catálogos propios de la Polla: organizaciones (una por capitalist), grupos,
 *  quinielas y turnos. */

export interface IPollaOrganizationEntityBack {
  polla_organization_id: string;
  name: string;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaOrganizationEntityFront = Omit<IPollaOrganizationEntityBack, 'deleted_at'>;

/** Organización como la lista el OWNER: con su capitalista. */
export interface IPollaOrganizationWithCapitalist extends IPollaOrganizationEntityFront {
  capitalist: {
    polla_user_id: string;
    name: string;
    last_name: string | null;
    username: string | null;
  } | null;
}

export interface IPollaGroupEntityBack {
  polla_group_id: string;
  polla_organization_id: string;
  name: string;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaGroupEntityFront = Omit<IPollaGroupEntityBack, 'deleted_at'>;

export interface IPollaLotteryEntityBack {
  polla_lottery_id: string;
  polla_organization_id: string;
  name: string;
  active: boolean;
  order: number;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaLotteryEntityFront = Omit<IPollaLotteryEntityBack, 'deleted_at'>;

export interface IPollaScheduleEntityBack {
  polla_schedule_id: string;
  polla_organization_id: string;
  name: string;
  time: string;
  active: boolean;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaScheduleEntityFront = Omit<IPollaScheduleEntityBack, 'deleted_at'>;
