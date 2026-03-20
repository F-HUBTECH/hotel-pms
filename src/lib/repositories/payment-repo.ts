import { createClient } from '@/lib/supabase/server'
import type { Payment } from '@/lib/types/database'
import type { PaymentFormValues } from '../validators/payment'

export class PaymentRepository {
    static async addPayment(data: PaymentFormValues & { created_by: string | null }): Promise<{ success: boolean; data?: Payment; error?: string }> {
        const supabase = await createClient()
        const { data: result, error } = await supabase
            .from('payments')
            .insert([{
                ...data,
                status: 'completed'
            }])
            .select()
            .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: result as Payment }
    }

    static async getPaymentsByReservation(reservationId: string): Promise<Payment[]> {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('payments')
            .select('*, created_by_user:profiles(first_name, last_name)')
            .eq('reservation_id', reservationId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        return data as Payment[]
    }
}
