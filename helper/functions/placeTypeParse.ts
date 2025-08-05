import { PLACE_TYPE } from '../types/bet.type';

export const placeTypeParse = (value?: string) => {
  switch (value) {
    case '1':
      return PLACE_TYPE.HEAD;
    case '5':
      return PLACE_TYPE.FIVE;
    case '10':
      return PLACE_TYPE.TEN;
    case '20':
      return PLACE_TYPE.TWENTY;
    default:
      return;
  }
};
