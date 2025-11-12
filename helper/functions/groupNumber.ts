/* import { CompactBet, IBetTable } from 'request/ticket.response';
import { ITicketEntityFront } from 'types/ticket.type';

export function groupTicketBetsByNumber(ticket: ITicketEntityFront): IBetTable[] {
  const byNumber = new Map<string, IBetTable>();

  for (const bet of ticket.bets) {
    const key = bet.number;

    if (!byNumber.has(key)) {
      byNumber.set(key, {
        number: bet.number,
        amount: bet.amount, // si hay montos distintos para el mismo número, abajo podés decidir estrategia
        place: bet.place,
        with: bet.with,
        position: bet.position,
        scheduleLottery: [],
      });
    }

    const entry = byNumber.get(key)!;

    // (opcional) Si detectás montos distintos para el mismo número, elegí estrategia:
    // if (entry.amount !== bet.amount) { mantener primero, último, sumar, etc.  }

    // merge por schedule
    const schId = bet.schedule.schedule_id;
    let sl = entry.scheduleLottery.find((s) => s.schedule.schedule_id === schId);
    if (!sl) {
      sl = { schedule: bet.schedule, lotteries: [] };
      entry.scheduleLottery.push(sl);
    }

    // agregar lottery sin duplicar
    const lotId = bet.lottery.lottery_id;
    if (!sl.lotteries.some((l) => l.lottery_id === lotId)) {
      sl.lotteries.push(bet.lottery);
    }
  }

  return Array.from(byNumber.values());
}

export const toCompactBets = (bets: IBetTable[]): CompactBet[] => {
  return bets.map((bet) => ({
    number: bet.number,
    amount: +bet.amount,
    place: bet.place,
    with: bet.with ?? null,
    position: bet.position ?? null,
    combinations: bet.scheduleLottery.map((schLot) => {
      return {
        schedule_id: schLot.schedule.schedule_id,
        lotteries_id: schLot.lotteries.map((lot) => lot.lottery_id),
      };
    }),
  }));
};
 */
