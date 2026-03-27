import { z } from 'zod';
export const updateLotterySchema = z.object({
    name: z.string().min(1),
});
export const newLotterySchema = z.object({
    name: z.string().min(1),
});
