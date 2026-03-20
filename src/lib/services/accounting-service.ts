import { createClient } from '../supabase/server'

export class AccountingService {
    /**
     * Posts a transaction to a folio and automatically generates the offset GL account postings.
     */
    static async postTransaction(
        folioId: string,
        type: 'room_charge' | 'service' | 'tax' | 'payment' | 'refund',
        description: string,
        amount: number,
        userId?: string | null,
        paymentMethod?: string | null
    ) {
        try {
            const supabase = await createClient()

            const { data, error } = await supabase.rpc('rpc_post_account_transaction', {
                p_folio_id: folioId,
                p_type: type,
                p_desc: description,
                p_amount: amount,
                p_user_id: userId || null,
                p_payment_method: paymentMethod || null
            })

            if (error) throw error

            return { success: true, transactionId: data }
        } catch (err: any) {
            console.error('AccountingService.postTransaction error:', err)
            return { success: false, error: err.message }
        }
    }

    /**
     * Get all transactions for a specific folio, including the user who posted them.
     */
    static async getFolioTransactions(folioId: string) {
        try {
            const supabase = await createClient()
            const { data, error } = await supabase
                .from('folio_transactions')
                .select(`
                    *,
                    posted_by_user:profiles(first_name, last_name)
                `)
                .eq('folio_id', folioId)
                .order('posted_at', { ascending: true })

            if (error) throw error
            return { success: true, data }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }

    /**
     * Get the double-entry account postings for a specific folio transaction.
     */
    static async getAccountPostings(transactionId: string) {
        try {
            const supabase = await createClient()
            const { data, error } = await supabase
                .from('account_postings')
                .select(`
                    *,
                    gl_account:chart_of_accounts(account_name, type)
                `)
                .eq('folio_transaction_id', transactionId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return { success: true, data }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }

    /**
     * Retrieve active payment methods mapped to GL accounts.
     */
    static async getPaymentMethods() {
        try {
            const supabase = await createClient()
            const { data, error } = await supabase
                .from('payment_methods')
                .select('*')
                .order('name')

            if (error) throw error
            return { success: true, data }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }
}
