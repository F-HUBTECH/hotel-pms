'use server'

import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '../services/payment-service'
import { AccountingService } from '../services/accounting-service'
import { paymentSchema } from '../validators/payment'
import type { PaymentFormValues } from '../validators/payment'
import { revalidatePath } from 'next/cache'

export async function processPaymentAction(data: PaymentFormValues) {
    try {
        const validated = paymentSchema.parse(data)

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const result = await PaymentService.processPayment(validated, user?.id || null)

        if (result.success && 'data' in result && result.data) {
            // Find folio
            const { data: folio } = await supabase
                .from('folios')
                .select('id')
                .eq('reservation_id', data.reservation_id)
                .single()

            if (folio) {
                // Use AccountingService to post the payment with GL offsets
                await AccountingService.postTransaction(
                    folio.id,
                    'payment',
                    `Payment (${validated.payment_method.replace('_', ' ').toUpperCase()})`,
                    validated.amount,
                    user?.id,
                    validated.payment_method
                )
            }

            revalidatePath(`/dashboard/reservations/${data.reservation_id}`)
            return { success: true }
        }

        return { success: false, error: result.error }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getReservationPaymentsAction(reservationId: string) {
    const result = await PaymentService.getReservationPayments(reservationId)
    if (!result.success) return { success: false, error: result.error }
    return { success: true, payments: result.payments, totalPaid: result.totalPaid }
}
