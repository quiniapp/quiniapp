import { IBetEntityBack, IBetEntityFront } from '@helper/types/bet.type';
import { parseLottery } from 'api/src/lottery/helper/parseLottery';
import { parseSchedule } from 'api/src/shcedule/helper/parseSchedule';

export const parseBet = (bet: IBetEntityBack): IBetEntityFront => {
  return {
    amount: bet.amount,
    bet_id: bet.bet_id,
    bet_type: bet.bet_type,
    date: bet.date,
    lottery_id: bet.lottery_id,
    number: bet.number,
    paid: bet.paid,
    place: bet.place,
    position: bet.position,
    schedule_id: bet.schedule_id,
    ticket_id: bet.ticket_id,
    user_id: bet.user_id,
    winner: bet.winner,
    with: bet.with,
    schedule: bet?.schedule && parseSchedule(bet.schedule),
    lottery: bet?.lottery && parseLottery(bet.lottery),
  };
};
