import { BET_TYPE } from '../types/bet.type';

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
