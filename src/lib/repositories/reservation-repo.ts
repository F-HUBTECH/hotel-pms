import { createClient } from '@/lib/supabase/server'
import type { Reservation } from '@/lib/types/database'

export interface CreateReservationDTO {
    property_id: string
    guest_id: string
    room_id?: string
    room_type_id: string
    check_in_date: string
    check_out_date: string
    adults: number
    children: number
    rate: number
    source_id?: string
    market_id?: string
    notes?: string
    created_by?: string
}

export class ReservationRepository {
    /**
     * Calls the PostgreSQL RPC function to securely lock inventory and create reservation in a single transaction.
     */
    static async createReservationWithTransaction(data: CreateReservationDTO): Promise<{ id: string } | { error: string }> {
        const supabase = await createClient()
        const { data: resvId, error } = await supabase.rpc('rpc_create_reservation', {
            p_property_id: data.property_id,
            p_guest_id: data.guest_id,
            p_room_id: data.room_id || null,
            p_room_type_id: data.room_type_id,
            p_check_in: data.check_in_date,
            p_check_out: data.check_out_date,
            p_adults: data.adults,
            p_children: data.children,
            p_rate: data.rate,
            p_source_id: data.source_id || null,
            p_market_id: data.market_id || null,
            p_notes: data.notes || '',
            p_created_by: data.created_by || null,
        })

        if (error) return { error: error.message }
        return { id: resvId }
    }

    static async getReservationById(id: string) {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('reservations')
            .select('*, guest:guests(*), room:rooms(*), room_type:room_types(*), source:booking_sources(*), market:markets(*)')
            .eq('id', id)
            .single()

        if (error) throw new Error(error.message)
        return data as Reservation & { guest: any; room?: any; room_type: any }
    }
}
