import { POLLA_NUMBERS_REQUIRED } from '@helper/polla/types/game.type';

export const createEmptyPollaNumbers = (): string[] => Array(POLLA_NUMBERS_REQUIRED).fill('');

/** Los números se pueden repetir: solo se exige que estén los 10 completos. */
export const pollaNumbersError = (values: string[]): string | null =>
  values.some((v) => !/^\d{2}$/.test(v)) ? `Completá los ${POLLA_NUMBERS_REQUIRED} números` : null;

/** "5" pasa a "05": se carga una cifra y el cero lo pone la caja. */
export const padPollaNumber = (value: string) => (value.length === 1 ? `0${value}` : value);
