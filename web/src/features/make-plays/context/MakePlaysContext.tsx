import { createContext, useContext } from 'react';

import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { IUserEntityFront } from '@helper/types/user.type';
import { IBetTable } from '@helper/request/ticket.response';

type PlayDetailsState = {
  ticketId?: string;
  totalAmount: number;
  partialAmount: number;
  bets: IBetTable[];
  cashier?: IUserEntityFront;
  lotteries: Map<string, ILotteryEntityFront>;
  schedules: Map<string, IScheduleEntityFront>;
  selectedIndexes: number[];
  userNumber?: number;
  isEnabledCreateBet: boolean;
  setBets: React.Dispatch<React.SetStateAction<IBetTable[]>>;
  setTotalAmount: React.Dispatch<React.SetStateAction<number>>;
  setPartialAmount: React.Dispatch<React.SetStateAction<number>>;
};

type PlayDetailsActions = {
  // setters simples
  setUserNumber: (n?: number) => void;
  setSelectedIndexes: React.Dispatch<React.SetStateAction<number[]>>;
  setLotteries: React.Dispatch<React.SetStateAction<Map<string, ILotteryEntityFront>>>;
  setSchedules: React.Dispatch<React.SetStateAction<Map<string, IScheduleEntityFront>>>;
  setIsEnabledCreateBet: (v: boolean) => void;

  // @helpers/acciones
  handleRecreateBet: (values: IBetTable[]) => void;
  handleCreateBet: () => void;
  handleEditTicket: (ticket_id: string) => void;
  handleResetBets: () => void;
  handleDeleteSelectedBets: () => void;
};

export type MakePlaysContextType = PlayDetailsState & {
  isEnabledCreateBetByAdmin: boolean;
} & PlayDetailsActions;

export const MakePlaysContext = createContext<MakePlaysContextType | null>(null);

export function usePlayDetails() {
  const ctx = useContext(MakePlaysContext);
  if (!ctx) {
    throw new Error('usePlayDetails debe utilizarse dentro de <MakePlaysProvider>');
  }
  return ctx;
}
