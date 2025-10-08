
import React, { createContext, useContext } from 'react';

import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { PLACE_TYPE } from '@helper/types/bet.type';
import { IUserEntityFront } from '@helper/types/user.type';
import { ITicketEntityFront } from '@helper/types/ticket.type';





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
};

type PlayDetailsActions = {
  // setters simples
  setUserNumber: (n?: number) => void;
  setSelectedIndexes: (idxs: number[]) => void;
  setLotteries: React.Dispatch<React.SetStateAction<Map<string, ILotteryEntityFront>>>;
  setSchedules: React.Dispatch<React.SetStateAction<Map<string, IScheduleEntityFront>>>;
  setIsEnabledCreateBet: (v: boolean) => void;

  // @helpers/acciones
  handleRecreateBet: (values: IBetTable[]) => void;
  handleCreateBet: () => void;
  handleEditTicket: (ticket: ITicketEntityFront) => void;
  handleResetBets: () => void;
  handleDeleteSelectedBets: () => void;
  
};

export type Ctx = PlayDetailsState & {
  isEnabledCreateBetByAdmin: boolean;
} & PlayDetailsActions;

export const PlayDetailsContext = createContext<Ctx | null>(null);



export function usePlayDetails() {
  const ctx = useContext(PlayDetailsContext);
  if (!ctx) {
    throw new Error('usePlayDetails debe utilizarse dentro de <PlayDetailsProvider>');
  }
  return ctx;
}
