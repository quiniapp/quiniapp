import { z } from 'zod';
export const validateUUID = z.object({
    user_id: z.string().uuid(),
});
