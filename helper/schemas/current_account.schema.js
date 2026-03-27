import { z } from 'zod';
export const updateCurrentAccountSchema = z.object({
    claims: z.number().optional(),
    collections: z.number().optional(),
    drag: z.number().optional(),
    paid: z.number().optional(),
    leave: z.number().optional(),
});
