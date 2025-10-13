import { z } from 'zod';
import { PLACE_TYPE } from '../types/bet.type';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// --- Schemas mínimos para schedule y lottery (solo IDs) ---
const scheduleFrontSchema = z.object({
  schedule_id: z.string().uuid(),
});

const lotteryFrontSchema = z.object({
  lottery_id: z.string().uuid(),
});

const lotteryScheduleSchema = z.object({
  schedule: scheduleFrontSchema,
  lotteries: z.array(lotteryFrontSchema).min(1, 'Debe seleccionar al menos 1 lotería'),
});

// --- IBetTable ---
export const BetTableSchema = z
  .object({
    number: z.string().min(1, 'El número no puede ser vacío'),
    amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
    place: z.nativeEnum(PLACE_TYPE),
    with: z.string().nullable(),
    position: z.nativeEnum(PLACE_TYPE).nullable().optional(),
    scheduleLottery: z.array(lotteryScheduleSchema).min(1, 'Debe seleccionar al menos 1 horario'),
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

    // Reglas por longitud / combinación (derivadas del schema anterior)
    // ONE (1 dígito)
    if (len === 1) {
      if (data.with) addIssue('with', 'No debe estar definido para número de 1 dígito');
      if (data.position) addIssue('position', 'No debe estar definido para número de 1 dígito');
    }

    // DOUBLE (2 dígitos) o REDOUBLE (2 + with de 2)
    if (len === 2) {
      if (withLen === 0) {
        // DOUBLE
        if (data.with)
          addIssue('with', 'No debe estar definido para número de 2 dígitos sin “with”');
        if (data.position)
          addIssue('position', 'No debe estar definido para número de 2 dígitos sin “with”');
      } else {
        // REDOUBLE (len=2 y with=2)
        if (withLen !== 2)
          addIssue('with', 'Para re-doble, "with" debe tener exactamente 2 dígitos');
        if (!data.position) addIssue('position', 'Para re-doble, "position" debe estar definida');

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
      }
    }

    // TERN (3 dígitos)
    if (len === 3) {
      if (data.with) addIssue('with', 'No debe estar definido para número de 3 dígitos');
      if (data.position) addIssue('position', 'No debe estar definido para número de 3 dígitos');
    }

    // QUATERN (4 dígitos)
    if (len === 4) {
      if (data.with) addIssue('with', 'No debe estar definido para número de 4 dígitos');
      if (data.position) addIssue('position', 'No debe estar definido para número de 4 dígitos');
    }

    // BORRATINA (10 dígitos)
    if (len === 10) {
      // with y position pueden ser null/undefined: no validar
    }

    // Validaciones de estructura: no duplicar schedules y cada nodo debe tener lotteries
    const scheduleIds = data.scheduleLottery.map((s) => s.schedule.schedule_id);
    const uniqueSchedules = new Set(scheduleIds);
    if (uniqueSchedules.size !== scheduleIds.length) {
      addIssue('scheduleLottery', 'No debe haber horarios repetidos dentro de la apuesta');
    }
    data.scheduleLottery.forEach((sl, i) => {
      if (sl.lotteries.length === 0) {
        addIssue(['scheduleLottery', i, 'lotteries'], 'Debe seleccionar al menos 1 lotería');
      }
    });
  });
