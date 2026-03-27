import { z } from 'zod';
import { dateRegex } from '../functions/dateRegex';
export const newResultsSchema = z.object({
    results: z
        .array(z.string().regex(/^\d{4}$/, { message: 'Debe tener exactamente 4 dígitos' }))
        .length(20, { message: 'Debe haber exactamente 20 números de 4 cifras' }),
    lottery_id: z.string(),
    schedule_id: z.string(),
    date: z
        .string()
        .regex(dateRegex, { message: 'Formato inválido YYYY-MM-DD' })
        .refine((date) => !isNaN(Date.parse(date)), {
        message: 'La fecha no es válida',
    })
        .optional(),
});
export const editResultsSchema = z.object({
    results: z
        .array(z.string().regex(/^\d{4}$/, { message: 'Debe tener exactamente 4 dígitos' }))
        .length(20, { message: 'Debe haber exactamente 20 números de 4 cifras' })
        .optional(),
    lottery_id: z.string().optional(),
    schedule_id: z.string().optional(),
    date: z
        .string()
        .regex(dateRegex, { message: 'Formato inválido YYYY-MM-DD' })
        .refine((date) => !isNaN(Date.parse(date)), {
        message: 'La fecha no es válida',
    })
        .optional(),
});
export const getResultsSchema = z.union([
    // Caso 1: solo results_id
    z.object({
        results_id: z.string(),
        date: z.undefined(),
        lottery_id: z.undefined(),
        schedule_id: z.undefined(),
    }),
    // Caso 2: date + lottery_id + schedule_id
    z.object({
        results_id: z.undefined(),
        date: z
            .string()
            .regex(dateRegex, { message: 'Formato inválido YYYY-MM-DD' })
            .refine((date) => !isNaN(Date.parse(date)), {
            message: 'La fecha no es válida',
        }),
        lottery_id: z.string(),
        schedule_id: z.string(),
    }),
]);
