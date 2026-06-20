import { z } from 'zod'

export const namedEntitySchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
})
