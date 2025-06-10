import { BET_TYPE, PLACE_TYPE } from '@helper/types/bet.type';
import { z } from 'zod';

export const newBetSchema = z
  .object({
    bet_type: z.nativeEnum(BET_TYPE),
    user_id: z.string().uuid(),
    number: z.string().min(1),
    amount: z.number().min(0.01),
    place: z.nativeEnum(PLACE_TYPE),
    with: z.string().nullable().optional(),
    position: z.nativeEnum(PLACE_TYPE).nullable().optional(),
    date: z.string(), // podrías refinar con dayjs si querés
    lottery_id: z.string().uuid(),
    schedule_id: z.string().uuid(),
  })
  .superRefine((data, ctx) => {
    const len = data.number.length;
    const withLen = data.with?.length ?? 0;

    const addIssue = (path: string | (string | number)[], message: string) => {
      ctx.addIssue({
        path: Array.isArray(path) ? path : [path],
        code: z.ZodIssueCode.custom,
        message,
      });
    };

    switch (data.bet_type) {
      case BET_TYPE.ONE:
        if (len !== 1) addIssue('number', 'Debe tener exactamente 1 dígito');
        if (data.with) addIssue('with', 'No debe estar definido para ONE');
        if (data.position) addIssue('position', 'No debe estar definido para ONE');
        break;

      case BET_TYPE.DOUBLE:
        if (len !== 2) addIssue('number', 'Debe tener exactamente 2 dígitos');
        if (data.with) addIssue('with', 'No debe estar definido para DOUBLE');
        if (data.position) addIssue('position', 'No debe estar definido para DOUBLE');
        break;

      case BET_TYPE.TERN:
        if (len !== 3) addIssue('number', 'Debe tener exactamente 3 dígitos');
        if (data.with) addIssue('with', 'No debe estar definido para TERN');
        if (data.position) addIssue('position', 'No debe estar definido para TERN');
        break;

      case BET_TYPE.QUATERN:
        if (len !== 4) addIssue('number', 'Debe tener exactamente 4 dígitos');
        if (data.with) addIssue('with', 'No debe estar definido para QUATERN');
        if (data.position) addIssue('position', 'No debe estar definido para QUATERN');
        break;

      case BET_TYPE.BORRATINA:
        if (len !== 10) addIssue('number', 'Debe tener exactamente 10 dígitos');
        // with y position pueden ser null o undefined, no se valida
        break;

      case BET_TYPE.REDOUBLE:
        if (len !== 2) addIssue('number', 'Debe tener exactamente 2 dígitos');
        if (!data.with || withLen !== 2) addIssue('with', 'Debe tener exactamente 2 dígitos');
        if (!data.position) addIssue('position', 'Debe estar definido');

        const validPositionsByPlace: Record<PLACE_TYPE, PLACE_TYPE[]> = {
          HEAD: [PLACE_TYPE.FIVE, PLACE_TYPE.TEN, PLACE_TYPE.TWENTY],
          FIVE: [PLACE_TYPE.FIVE, PLACE_TYPE.TEN, PLACE_TYPE.TWENTY],
          TEN: [PLACE_TYPE.TEN, PLACE_TYPE.TWENTY],
          TWENTY: [PLACE_TYPE.TWENTY],
        };

        if (
          data.position &&
          (!validPositionsByPlace[data.place] ||
            !validPositionsByPlace[data.place].includes(data.position))
        ) {
          addIssue(
            'position',
            `Para place ${data.place}, position debe ser una de: ${validPositionsByPlace[data.place].join(', ')}`
          );
        }
        break;
    }
  });
