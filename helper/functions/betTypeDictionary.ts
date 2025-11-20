import { BET_TYPE, PLACE_TYPE } from '../types/bet.type';
import { betPlaceDictionary } from './betPlaceDictionary';

export const betTypeDictionary = (length?: number, redouble?: boolean) => {
  switch (length) {
    case 10:
      return BET_TYPE.BORRATINA;
      break;
    case 4:
      return BET_TYPE.QUATERN;
      break;
    case 3:
      return BET_TYPE.TERN;
      break;
    case 2:
      if (length === 2 && redouble) return BET_TYPE.REDOUBLE;
      return BET_TYPE.DOUBLE;
      break;
    case 1:
      return BET_TYPE.ONE;
      break;
  }
};

export const betTypeAndPlaceLabel = (
  bet_type: BET_TYPE,
  place: PLACE_TYPE,
  position?: PLACE_TYPE | null
) => {
  switch (bet_type) {
    case BET_TYPE.BORRATINA:
      return `BORR`;
      break;
    case BET_TYPE.REDOUBLE:
      return `RED ${betPlaceDictionary[place] === 'CABEZA' ? '1' : betPlaceDictionary[place]}${position ? ` - ${betPlaceDictionary[position]}` : ''}`;
      break;
    default:
      return `${betPlaceDictionary[place]}`;
      break;
  }
};
