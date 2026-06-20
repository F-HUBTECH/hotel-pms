import { PaymentRepository } from '../repositories/payment-repo'
import type { PaymentFormValues } from '../validators/payment'

interface PaymentLike {
    status: string
    amount: number
}

/** Sum amounts of completed payments only */
export function calculateTotalPaid(payments: PaymentLike[]): number {
    return payments.reduce(
        (sum, p) => p.status === 'completed' ? sum + Number(p.amount) : sum,
        0,
    )
}

export class PaymentService {
    /**
     * Process a payment and add it to the reservation.
     * In a real system with Stripe/Omise, the gateway call would happen here.
     */
    static async processPayment(data: PaymentFormValues, userId: string | null) {
        try {
            // Future: Call payment gateway here
            // For now, assume success and save to database

            const result = await PaymentRepository.addPayment({
                ...data,
                created_by: userId
            })

            return result
        } catch (err: any) {
            return { success: false, error: err.message || 'Payment processing failed' }
        }
    }

    static async getReservationPayments(reservationId: string) {
        try {
            const payments = await PaymentRepository.getPaymentsByReservation(reservationId)
            const totalPaid = calculateTotalPaid(payments)
            return { success: true, payments, totalPaid }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }
}
