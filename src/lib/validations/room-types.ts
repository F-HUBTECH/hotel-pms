import { z } from 'zod'

export const roomTypeSchema = z.object({
    code: z
        .string()
        .min(1, 'Code is required')
        .max(10, 'Code must be 10 characters or less')
        .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and numbers only'),
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less'),
    description: z
        .string()
        .max(500, 'Description must be 500 characters or less')
        .default(''),
    base_price: z
        .number({ error: 'Price must be a number' })
        .min(0, 'Price must be 0 or greater')
        .max(999999.99, 'Price is too large'),
})

export type RoomTypeFormData = z.infer<typeof roomTypeSchema>
