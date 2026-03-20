import { z } from 'zod'

export const paymentSchema = z.object({
    reservation_id: z.string().uuid(),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
    payment_method: z.enum(['cash', 'credit_card', 'transfer', 'other']),
    reference_number: z.string().optional(),
    notes: z.string().optional(),
})

export type PaymentFormValues = z.infer<typeof paymentSchema>
