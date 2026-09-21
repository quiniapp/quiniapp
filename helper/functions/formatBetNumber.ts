import { BET_TYPE } from '../types/bet.type';

// Borratina guarda sus 10 dígitos (5 duplas) concatenados sin separador
// (ej "0714235699"); esto los separa con guion para legibilidad ("07-14-23-56-99").
export const formatBetNumber = (number: string, bet_type: BET_TYPE): string => {
  if (bet_type !== BET_TYPE.BORRATINA) return number;
  return number.match(/.{1,2}/g)?.join('-') ?? number;
};
