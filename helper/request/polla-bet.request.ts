export type INewPollaBetEntity = {
  polla_edition_id: string;
  user_id: string | null;
  user_name: string;
  numbers: string[];
};

export type IUpdatePollaBetEntity = {
  numbers: string[];
};

export type IDeletePollaBetEntity = {
  polla_bet_id: string;
};
