import { BET_TYPE, PLACE_TYPE } from '../types/bet.type';
export declare const betTypeDictionary: (
  length?: number,
  redouble?: boolean
) => BET_TYPE | undefined;
export declare const betTypeAndPlaceLabel: (
  bet_type: BET_TYPE,
  place: PLACE_TYPE,
  position?: PLACE_TYPE | null
) => string;
