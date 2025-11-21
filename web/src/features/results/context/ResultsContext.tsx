import { createContext, useContext } from 'react';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';

type ResultsState = {
  // Data state
  results: string[];
  selectedSchedule?: string;
  selectedLottery?: string;
  selectedDate: string;
  scheduleWinners?: string;

  // UI state
  isOpen: boolean;
  isOpenDeleteResult: boolean;
  onEdit: boolean;

  // Fetched data
  fetchSchedules?: IScheduleEntityFront[];
  lotteries?: ILotteryEntityFront[];
  getResults?: {
    results_id: string;
    results: string[];
  };

  // Loading states
  isPending: boolean;
  isPendingResults: boolean;
  isPendingWinners: boolean;
  isPendingDeleteResults: boolean;
  isSuccess: boolean;

  // Input refs
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;

  // Setters
  setResults: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSchedule: React.Dispatch<React.SetStateAction<string | undefined>>;
  setSelectedLottery: React.Dispatch<React.SetStateAction<string | undefined>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  setScheduleWinners: React.Dispatch<React.SetStateAction<string | undefined>>;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsOpenDeleteResult: React.Dispatch<React.SetStateAction<boolean>>;
  setOnEdit: React.Dispatch<React.SetStateAction<boolean>>;
};

type ResultsActions = {
  handleScheduleSelect: (scheduleId: string) => void;
  handleLotterySelect: (lotteryId: string) => void;
  handleGenerate: () => void;
  handleSave: () => void;
  handleDeleteResult: () => void;
  canSave: boolean;
};

export type ResultsContextType = ResultsState & ResultsActions;

export const ResultsContext = createContext<ResultsContextType | null>(null);

export function useResults() {
  const ctx = useContext(ResultsContext);
  if (!ctx) {
    throw new Error('useResults debe utilizarse dentro de <ResultsProvider>');
  }
  return ctx;
}
