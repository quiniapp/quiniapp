export interface IPollaBetEntityBack {
  polla_bet_id: string;
  ticket_id: string;
  ticket_number: string;
  polla_edition_id: string;
  organization_id: string;
  user_id: string | null;
  user_name: string;
  load_date: string;
  numbers: string[];
  hit_numbers: string[];
  hits: number;
  winner: boolean;
  prize: number;
  hit_date: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export type IPollaBetEntityFront = Omit<
  IPollaBetEntityBack,
  'organization_id' | 'created_at' | 'deleted_at' | 'deleted_by'
>;
