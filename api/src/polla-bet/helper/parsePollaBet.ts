import { IPollaBetEntityBack, IPollaBetEntityFront } from '@helper/types/polla-bet.type';

export const parsePollaBet = (bet: IPollaBetEntityBack): IPollaBetEntityFront => {
  return {
    polla_bet_id: bet.polla_bet_id,
    ticket_id: bet.ticket_id,
    ticket_number: bet.ticket_number,
    polla_edition_id: bet.polla_edition_id,
    user_id: bet.user_id,
    user_name: bet.user_name,
    load_date: bet.load_date,
    numbers: bet.numbers,
    hit_numbers: bet.hit_numbers,
    hits: bet.hits,
    winner: bet.winner,
    prize: bet.prize,
    hit_date: bet.hit_date,
  };
};
